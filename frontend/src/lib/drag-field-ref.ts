export const FIELD_REF_MIME = "application/6flow-field-ref";

export interface FieldRefDragData {
  nodeId: string;
  path: string;
}

export function encodeFieldRef(data: FieldRefDragData): string {
  return JSON.stringify(data);
}

export function decodeFieldRef(raw: string): FieldRefDragData | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.nodeId === "string" && typeof parsed.path === "string") {
      return parsed as FieldRefDragData;
    }
    return null;
  } catch {
    return null;
  }
}

export function buildExpression(data: FieldRefDragData): string {
  return `{{${data.nodeId}.${data.path}}}`;
}
