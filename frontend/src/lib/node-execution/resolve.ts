import type { Workflow } from "@6flow/shared/model/node";

const TEMPLATE_REF_REGEX = /\{\{([^{}]+)\}\}/g;

export class NodeExecutionReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NodeExecutionReferenceError";
  }
}

export function resolveTemplateValue(input: string, workflow: Workflow): unknown {
  const trimmed = input.trim();
  const pureMatch = trimmed.match(/^\{\{([^{}]+)\}\}$/);
  if (pureMatch) {
    return resolveReference(pureMatch[1] ?? "", workflow);
  }

  return input.replaceAll(TEMPLATE_REF_REGEX, (_match, rawReference: string) => {
    const resolved = resolveReference(rawReference, workflow);
    return coerceTemplateSegment(resolved);
  });
}

function resolveReference(rawReference: string, workflow: Workflow): unknown {
  const reference = rawReference.trim();
  const [root, ...rest] = reference.split(".");
  const path = rest.join(".");

  if (root === "trigger") {
    throw new NodeExecutionReferenceError(
      `Cannot resolve trigger reference '{{${reference}}}' during node execution preview.`,
    );
  }

  if (root === "config") {
    if (!path) {
      return workflow.globalConfig;
    }
    return getByPath(workflow.globalConfig as unknown, path, reference);
  }

  const sourceNode = workflow.nodes.find((node) => node.id === root);
  if (!sourceNode) {
    throw new NodeExecutionReferenceError(
      `Referenced node '${root}' was not found for '{{${reference}}}'.`,
    );
  }

  const executedOutput = sourceNode.data.editor?.lastExecution?.normalized;
  if (executedOutput === undefined) {
    throw new NodeExecutionReferenceError(
      `Node '${root}' must be executed before resolving '{{${reference}}}'.`,
    );
  }

  if (!path) {
    return executedOutput;
  }

  return getByPath(executedOutput, path, reference);
}

function getByPath(value: unknown, path: string, reference: string): unknown {
  const segments = path.split(".").filter(Boolean);
  let current: unknown = value;

  for (const segment of segments) {
    if (current == null || typeof current !== "object" || Array.isArray(current)) {
      throw new NodeExecutionReferenceError(
        `Reference '{{${reference}}}' could not be resolved at '${segment}'.`,
      );
    }

    if (!(segment in current)) {
      throw new NodeExecutionReferenceError(
        `Reference '{{${reference}}}' does not exist on the executed output.`,
      );
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function coerceTemplateSegment(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return JSON.stringify(value);
}
