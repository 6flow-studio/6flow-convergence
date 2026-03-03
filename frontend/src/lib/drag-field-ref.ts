export const FIELD_REF_MIME = "application/6flow-field-ref";

export interface FieldRefDragData {
  nodeId: string;
  nodeName: string; // node label, used for human-readable expressions
  path: string;
}

export function encodeFieldRef(data: FieldRefDragData): string {
  return JSON.stringify(data);
}

export function decodeFieldRef(raw: string): FieldRefDragData | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.nodeId === "string" && typeof parsed.path === "string") {
      return {
        nodeId: parsed.nodeId,
        // backward compat: fall back to nodeId if nodeName is missing
        nodeName: typeof parsed.nodeName === "string" ? parsed.nodeName : parsed.nodeId,
        path: parsed.path,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function buildExpression(data: FieldRefDragData): string {
  return `{{${data.nodeName}.${data.path}}}`;
}
