import type {
  DataSchema,
  NodeExecutionPreview,
  NodeType,
  Workflow,
} from "@6flow/shared/model/node";

export const EXECUTION_PREVIEW_NODE_TYPES = [
  "httpRequest",
  "evmRead",
  "evmWrite",
] as const;

export type ExecutionPreviewNodeType =
  (typeof EXECUTION_PREVIEW_NODE_TYPES)[number];

export interface ExecuteNodeRequest {
  workflow: Workflow;
  nodeId: string;
}

export interface ExecuteNodeResponse {
  preview: NodeExecutionPreview;
  schema: DataSchema;
  executedAt: string;
}

export interface ExecuteNodeErrorResponse {
  error: string;
  code?: string;
  detail?: string;
}

export function isExecutionPreviewSupported(
  nodeType: NodeType,
): nodeType is ExecutionPreviewNodeType {
  return EXECUTION_PREVIEW_NODE_TYPES.includes(
    nodeType as ExecutionPreviewNodeType,
  );
}
