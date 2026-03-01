import type {
  DataSchema,
  DataSchemaField,
  DataSchemaType,
} from "@6flow/shared/model/node";

const MAX_DEPTH = 6;
const MAX_ARRAY_ITEMS = 20;
const MAX_OBJECT_KEYS = 50;
const MAX_STRING_LENGTH = 2000;

interface SanitizedValueResult {
  value: unknown;
  truncated: boolean;
}

export function sanitizeExecutionValue(value: unknown): SanitizedValueResult {
  return sanitizeValue(value, 0);
}

export function inferDataSchema(value: unknown): DataSchema {
  return inferSchemaNode(value, "", 0);
}

export function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(
      value,
      (_key, item) => {
        if (typeof item === "bigint") {
          return item.toString();
        }
        if (item instanceof Error) {
          return {
            name: item.name,
            message: item.message,
          };
        }
        return item;
      },
      2,
    );
  } catch {
    return JSON.stringify(String(value));
  }
}

function sanitizeValue(value: unknown, depth: number): SanitizedValueResult {
  if (depth >= MAX_DEPTH) {
    return { value: "[truncated]", truncated: true };
  }

  if (value == null || typeof value === "number" || typeof value === "boolean") {
    return { value, truncated: false };
  }

  if (typeof value === "bigint") {
    return { value: value.toString(), truncated: false };
  }

  if (typeof value === "string") {
    if (value.length <= MAX_STRING_LENGTH) {
      return { value, truncated: false };
    }
    return {
      value: `${value.slice(0, MAX_STRING_LENGTH)}...`,
      truncated: true,
    };
  }

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS);
    const sanitizedItems = items.map((item) => sanitizeValue(item, depth + 1));
    return {
      value: sanitizedItems.map((item) => item.value),
      truncated:
        value.length > MAX_ARRAY_ITEMS ||
        sanitizedItems.some((item) => item.truncated),
    };
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value).slice(0, MAX_OBJECT_KEYS);
    let truncated = Object.keys(value).length > MAX_OBJECT_KEYS;
    const next: Record<string, unknown> = {};

    for (const [key, child] of entries) {
      const sanitizedChild = sanitizeValue(child, depth + 1);
      next[key] = sanitizePreviewKeyValue(key, sanitizedChild.value);
      truncated ||= sanitizedChild.truncated;
    }

    return { value: next, truncated };
  }

  return { value: String(value), truncated: false };
}

function inferSchemaNode(value: unknown, path: string, depth: number): DataSchema {
  const type = getSchemaType(value);

  if (depth >= MAX_DEPTH) {
    return { type: "unknown", path };
  }

  if (type === "array") {
    const items = Array.isArray(value) ? value.slice(0, MAX_ARRAY_ITEMS) : [];
    return {
      type,
      path,
      itemSchema:
        items.length === 0
          ? { type: "unknown", path: appendArrayPath(path) }
          : mergeSchemas(
              items.map((item) =>
                inferSchemaNode(item, appendArrayPath(path), depth + 1),
              ),
              appendArrayPath(path),
            ),
    };
  }

  if (type === "object" && isPlainObject(value)) {
    const entries = Object.entries(value).slice(0, MAX_OBJECT_KEYS);
    const fields: DataSchemaField[] = entries.map(([key, child]) => {
      const childPath = appendFieldPath(path, key);
      return {
        key,
        path: childPath,
        schema: inferSchemaNode(child, childPath, depth + 1),
      };
    });

    return {
      type,
      path,
      fields,
    };
  }

  return { type, path };
}

function mergeSchemas(schemas: DataSchema[], path: string): DataSchema {
  if (schemas.length === 0) {
    return { type: "unknown", path };
  }

  const firstType = schemas[0]?.type ?? "unknown";
  if (schemas.some((schema) => schema.type !== firstType)) {
    return { type: "unknown", path };
  }

  if (firstType === "object") {
    const fieldBuckets = new Map<string, DataSchemaField[]>();
    for (const schema of schemas) {
      for (const field of schema.fields ?? []) {
        const bucket = fieldBuckets.get(field.key) ?? [];
        bucket.push(field);
        fieldBuckets.set(field.key, bucket);
      }
    }

    const fields = Array.from(fieldBuckets.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, bucket]) => ({
        key,
        path: bucket[0]?.path ?? appendFieldPath(path, key),
        schema: mergeSchemas(
          bucket.map((field) => field.schema),
          bucket[0]?.path ?? appendFieldPath(path, key),
        ),
        optional: bucket.length < schemas.length,
      }));

    return {
      type: "object",
      path,
      fields,
    };
  }

  if (firstType === "array") {
    const itemSchemas = schemas
      .map((schema) => schema.itemSchema)
      .filter((schema): schema is DataSchema => Boolean(schema));

    return {
      type: "array",
      path,
      itemSchema: mergeSchemas(itemSchemas, appendArrayPath(path)),
    };
  }

  return { type: firstType, path };
}

function appendFieldPath(path: string, field: string): string {
  return path ? `${path}.${field}` : field;
}

function appendArrayPath(path: string): string {
  return path ? `${path}[]` : "[]";
}

function getSchemaType(value: unknown): DataSchemaType {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  if (isPlainObject(value)) {
    return "object";
  }
  switch (typeof value) {
    case "string":
      return "string";
    case "number":
    case "bigint":
      return "number";
    case "boolean":
      return "boolean";
    default:
      return "unknown";
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizePreviewKeyValue(key: string, value: unknown): unknown {
  if (!isSensitiveKey(key)) {
    return value;
  }
  return "[redacted]";
}

function isSensitiveKey(key: string): boolean {
  return /(secret|token|api[_-]?key|authorization|password|signature)/i.test(
    key,
  );
}
