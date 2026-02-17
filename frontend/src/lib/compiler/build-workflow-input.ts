import type { Workflow } from "@6flow/shared/model/node";
import { fromReactFlowNodes } from "@/lib/workflow-convert";
import {
  WORKFLOW_VERSION,
  cloneGlobalConfig,
} from "@/lib/workflow-defaults";
import type { WorkflowNode, WorkflowEdge } from "@/lib/editor-store";
import type { GlobalConfig } from "@6flow/shared/model/node";

export interface WorkflowCompilerInput {
  workflowId: string | null;
  workflowName: string;
  workflowCreatedAt: string | null;
  workflowGlobalConfig: GlobalConfig;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export function buildWorkflowInput(input: WorkflowCompilerInput): Workflow {
  const nowIso = new Date().toISOString();

  return {
    id: input.workflowId ?? `workflow_${Date.now()}`,
    name: input.workflowName || "Untitled Workflow",
    version: WORKFLOW_VERSION,
    nodes: fromReactFlowNodes(input.nodes),
    edges: input.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? undefined,
      targetHandle: edge.targetHandle ?? undefined,
    })),
    globalConfig: cloneGlobalConfig(input.workflowGlobalConfig),
    createdAt: input.workflowCreatedAt ?? nowIso,
    updatedAt: nowIso,
  };
}
