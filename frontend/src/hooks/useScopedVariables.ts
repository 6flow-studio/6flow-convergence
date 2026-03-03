import { useEditorStore, type WorkflowNode } from "@/lib/editor-store";
import { getNodeEntry } from "@/lib/node-registry";

export interface VariableInfo {
  /** Flat variable name, e.g. "marketId" */
  name: string;
  /** Schema type string, e.g. "string", "number", "boolean" */
  type: string;
  /** Node label this variable comes from */
  source: string;
  /** Template expression for use in config fields: {{nodeName.path}} */
  expression: string;
  /** Insert text for TypeScript code: bare name for triggers, nodeName.field for steps */
  codeInsert: string;
  /** Whether the source node is a trigger */
  isTrigger: boolean;
}

/**
 * Returns all variables in scope for the currently selected node.
 * Walks upstream edges and flattens each upstream node's outputSchema.fields.
 */
export function useScopedVariables(): VariableInfo[] {
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);

  if (!selectedNodeId) return [];

  const upstreamEdges = edges.filter((e) => e.target === selectedNodeId);
  const upstreamNodes = upstreamEdges
    .map((e) => nodes.find((n) => n.id === e.source))
    .filter((n): n is WorkflowNode => n != null);

  const variables: VariableInfo[] = [];

  for (const node of upstreamNodes) {
    const schema = node.data.editor?.outputSchema;
    if (!schema?.fields) continue;

    const entry = getNodeEntry(node.data.nodeType);
    const isTrigger = entry?.category === "trigger";
    const nodeName = node.data.label;

    for (const field of schema.fields) {
      variables.push({
        name: field.key,
        type: field.schema.type,
        source: nodeName,
        expression: `{{${nodeName}.${field.path}}}`,
        codeInsert: isTrigger ? field.key : `${nodeName}.${field.key}`,
        isTrigger,
      });

      // Flatten one level of nested object fields
      if (field.schema.fields) {
        for (const nested of field.schema.fields) {
          variables.push({
            name: `${field.key}.${nested.key}`,
            type: nested.schema.type,
            source: nodeName,
            expression: `{{${nodeName}.${nested.path}}}`,
            codeInsert: isTrigger
              ? `${field.key}.${nested.key}`
              : `${nodeName}.${field.key}.${nested.key}`,
            isTrigger,
          });
        }
      }
    }
  }

  return variables;
}
