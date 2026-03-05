import type {
  AbiParameter,
  DataSchema,
  DataSchemaType,
} from "@6flow/shared/model/node";

export function appendFieldPath(path: string, field: string) {
  return path ? `${path}.${field}` : field;
}

export function appendArrayPath(path: string) {
  return path ? `${path}[]` : "[]";
}

export function mapAbiTypeToSchemaType(abiType: string): DataSchemaType {
  if (abiType === "bool") {
    return "boolean";
  }
  if (
    abiType === "address" ||
    abiType === "string" ||
    abiType.startsWith("bytes")
  ) {
    return "string";
  }
  if (abiType.startsWith("uint") || abiType.startsWith("int")) {
    return "number";
  }
  return "unknown";
}

export function abiParamToSchema(param: AbiParameter, path: string): DataSchema {
  if (param.type.endsWith("[]")) {
    const itemType = param.type.slice(0, -2);
    return {
      type: "array",
      path,
      itemSchema: abiParamToSchema(
        {
          ...param,
          type: itemType,
        },
        appendArrayPath(path),
      ),
    };
  }

  if (param.type === "tuple") {
    const fields = (param.components ?? []).map((component, index) => {
      const key = component.name.trim() || `field${index}`;
      const fieldPath = appendFieldPath(path, key);
      return {
        key,
        path: fieldPath,
        schema: abiParamToSchema(component, fieldPath),
      };
    });

    return {
      type: "object",
      path,
      fields,
    };
  }

  return {
    type: mapAbiTypeToSchemaType(param.type),
    path,
  };
}
