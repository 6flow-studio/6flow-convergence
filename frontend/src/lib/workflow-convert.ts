/**
 * SYNC NOTE: Conversion assumes `node.type` is the shared NodeType from
 * `shared/model/node.ts` and React Flow `type` is NodeCategory.
 * Re-check this file when NodeType/NodeCategory changes.
 */
import type { NodeType, WorkflowNode as SharedWorkflowNode } from "@6flow/shared/model/node";
import { getNodeCategory } from "@6flow/shared/model/node";
import type { WorkflowNode } from "./editor-store";

/**
 * Convert shared-model nodes (Convex/compiler format) to React Flow nodes.
 * - Moves `node.type` (NodeType) into `node.data.nodeType`
 * - Sets `node.type` to the NodeCategory string for React Flow component lookup
 */
export function toReactFlowNodes(nodes: SharedWorkflowNode[]): WorkflowNode[] {
  return nodes.map((node) => {
    // Legacy format: if data already has nodeType, it was saved in RF format
    if ("nodeType" in node.data) {
      return node as unknown as WorkflowNode;
    }

    const nodeType = node.type as NodeType;
    return {
      id: node.id,
      type: getNodeCategory(nodeType),
      position: node.position,
      data: {
        label: node.data.label,
        nodeType,
        config: node.data.config as unknown as Record<string, unknown>,
        editor: node.data.editor,
      },
    };
  });
}

/**
 * Convert React Flow nodes back to shared-model format (Convex/compiler format).
 * - Restores `node.data.nodeType` back to `node.type`
 * - Strips `nodeType` from data
 */
function stripTrailingAutoReturnLines(code: string): string {
  const lines = code.split("\n");
  let end = lines.length - 1;

  while (end >= 0 && lines[end].trim() === "") {
    end -= 1;
  }

  const autoReturnPattern = /^return\s*\{\s*[^{}]*\}\s*;$/;
  while (end >= 0 && autoReturnPattern.test(lines[end].trim())) {
    lines.splice(end, 1);
    end -= 1;
    while (end >= 0 && lines[end].trim() === "") {
      end -= 1;
    }
  }

  return lines.join("\n").trimEnd();
}

export function fromReactFlowNodes(
  nodes: WorkflowNode[],
  options?: { includeCompileReturnLine?: boolean }
): SharedWorkflowNode[] {
  return nodes.map((node) => {
    const { nodeType, label, config, editor, ...rest } = node.data;
    void rest; // discard extra RF data keys

    let resolvedConfig = config;
    if (nodeType === "codeNode" && options?.includeCompileReturnLine) {
      const outputFields = (config.outputFields as Array<{ key: string }> | undefined) ?? [];
      const validKeys = outputFields.map((f) => f.key).filter(Boolean);
      if (validKeys.length > 0) {
        const returnLine = `return { ${validKeys.join(", ")} };`;
        const baseCode = stripTrailingAutoReturnLines(String(config.code ?? ""));
        resolvedConfig = {
          ...config,
          code: `${baseCode}\n${returnLine}`,
        };
      }
    }

    return {
      id: node.id,
      type: nodeType,
      position: node.position,
      data: {
        label,
        config: resolvedConfig,
        editor,
      },
    } as unknown as SharedWorkflowNode;
  });
}
