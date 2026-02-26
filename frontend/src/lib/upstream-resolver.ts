/**
 * Upstream Node Resolver
 *
 * Given a target node, computes all upstream (ancestor) nodes with their
 * resolved output schemas via BFS backward through edges.
 *
 * Passthrough nodes (if, filter, merge) are transparent — the resolver
 * traverses through them to find the actual data-producing ancestors.
 */

import type { NodeType } from "@6flow/shared/model/node";
import {
  NODE_OUTPUT_SCHEMAS,
  resolveOutputFields,
  type OutputField,
  type SchemaMode,
} from "@6flow/shared/model/output-schema";
import type { WorkflowNode, WorkflowEdge } from "./editor-store";

export interface UpstreamNodeInfo {
  nodeId: string;
  nodeLabel: string;
  nodeType: NodeType;
  /** Which output handle this came through (e.g. "output", "true", "false") */
  sourceHandle: string;
  /** Resolved output fields */
  fields: OutputField[];
  schemaMode: SchemaMode;
}

const PASSTHROUGH_TYPES: Set<string> = new Set(["if", "filter", "merge"]);

/**
 * Get all upstream nodes for a given target node, closest first.
 */
export function getUpstreamNodes(
  targetNodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): UpstreamNodeInfo[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const result: UpstreamNodeInfo[] = [];
  const visited = new Set<string>();

  // BFS queue: node IDs to explore incoming edges for
  const queue: string[] = [targetNodeId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    // Find all edges targeting this node
    const incomingEdges = edges.filter((e) => e.target === currentId);

    for (const edge of incomingEdges) {
      if (visited.has(edge.source)) continue;
      visited.add(edge.source);

      const sourceNode = nodeMap.get(edge.source);
      if (!sourceNode) continue;

      const nodeType = sourceNode.data.nodeType;
      const schema = NODE_OUTPUT_SCHEMAS[nodeType];
      const sourceHandle = edge.sourceHandle ?? "output";

      // Passthrough nodes: skip them but continue BFS through them
      if (PASSTHROUGH_TYPES.has(nodeType)) {
        queue.push(edge.source);
        continue;
      }

      // Resolve fields based on schema mode
      let fields: OutputField[];
      if (schema.schemaMode === "static") {
        fields = schema.fields;
      } else if (schema.schemaMode === "config-derived") {
        fields = resolveOutputFields(
          nodeType,
          sourceNode.data.config as Record<string, unknown>,
        );
      } else {
        // dynamic — no fields
        fields = [];
      }

      result.push({
        nodeId: edge.source,
        nodeLabel: sourceNode.data.label,
        nodeType,
        sourceHandle,
        fields,
        schemaMode: schema.schemaMode,
      });

      // Continue BFS for transitive ancestors
      queue.push(edge.source);
    }
  }

  return result;
}
