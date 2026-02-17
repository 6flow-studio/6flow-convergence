import { create } from "zustand";
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from "@xyflow/react";
import type { GlobalConfig, NodeType } from "@6flow/shared/model/node";
import type { CompilerUiError } from "./compiler/compiler-types";
import { getNodeEntry } from "./node-registry";
import {
  DEFAULT_WORKFLOW_GLOBAL_CONFIG,
  cloneGlobalConfig,
} from "./workflow-defaults";

export interface WorkflowNodeData {
  label: string;
  nodeType: NodeType;
  config: Record<string, unknown>;
  [key: string]: unknown;
}

export type WorkflowNode = Node<WorkflowNodeData>;
export type WorkflowEdge = Edge;

interface EditorState {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeId: string | null;
  workflowName: string;
  workflowId: string | null;
  workflowCreatedAt: string | null;
  workflowGlobalConfig: GlobalConfig;
  workflowErrors: CompilerUiError[];
  liveNodeErrorsByNodeId: Record<string, CompilerUiError[]>;

  onNodesChange: OnNodesChange<WorkflowNode>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (type: NodeType, position: { x: number; y: number }) => void;
  removeNode: (id: string) => void;
  removeEdge: (id: string) => void;
  updateNodeConfig: (id: string, config: Record<string, unknown>) => void;
  updateNodeLabel: (id: string, label: string) => void;
  selectNode: (id: string | null) => void;
  clearSelection: () => void;
  setWorkflowName: (name: string) => void;
  setWorkflowId: (id: string | null) => void;
  setWorkflowCreatedAt: (createdAt: string | null) => void;
  setWorkflowGlobalConfig: (config: GlobalConfig) => void;
  setWorkflowErrors: (errors: CompilerUiError[]) => void;
  setNodeLiveErrors: (nodeId: string, errors: CompilerUiError[]) => void;
  clearNodeLiveErrors: (nodeId: string) => void;
  replaceNodeLiveErrorsByNodeId: (
    errorsByNodeId: Record<string, CompilerUiError[]>
  ) => void;
  clearCompilerErrors: () => void;
  loadWorkflow: (nodes: WorkflowNode[], edges: WorkflowEdge[]) => void;
}

let nodeIdCounter = 0;

function generateNodeId(): string {
  return `node_${Date.now()}_${nodeIdCounter++}`;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  workflowName: "Untitled Workflow",
  workflowId: null,
  workflowCreatedAt: null,
  workflowGlobalConfig: cloneGlobalConfig(DEFAULT_WORKFLOW_GLOBAL_CONFIG),
  workflowErrors: [],
  liveNodeErrorsByNodeId: {},

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    set({ edges: addEdge(connection, get().edges) });
  },

  addNode: (type, position) => {
    const entry = getNodeEntry(type);
    if (!entry) return;

    const newNode: WorkflowNode = {
      id: generateNodeId(),
      type: entry.category,
      position,
      data: {
        label: entry.label,
        nodeType: type,
        config: { ...entry.defaultConfig },
      },
    };

    set({ nodes: [...get().nodes, newNode] });
  },

  removeEdge: (id) => {
    set({ edges: get().edges.filter((e) => e.id !== id) });
  },

  removeNode: (id) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId,
    });
  },

  updateNodeConfig: (id, config) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, config: { ...n.data.config, ...config } } } : n
      ),
    });
  },

  updateNodeLabel: (id, label) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, label } } : n
      ),
    });
  },

  selectNode: (id) => set({ selectedNodeId: id }),
  clearSelection: () => set({ selectedNodeId: null }),
  setWorkflowName: (name) => set({ workflowName: name }),
  setWorkflowId: (id) => set({ workflowId: id }),
  setWorkflowCreatedAt: (createdAt) => set({ workflowCreatedAt: createdAt }),
  setWorkflowGlobalConfig: (config) =>
    set({
      workflowGlobalConfig: cloneGlobalConfig(config),
    }),
  setWorkflowErrors: (errors) => set({ workflowErrors: errors }),
  setNodeLiveErrors: (nodeId, errors) =>
    set({
      liveNodeErrorsByNodeId: {
        ...get().liveNodeErrorsByNodeId,
        [nodeId]: errors,
      },
    }),
  clearNodeLiveErrors: (nodeId) => {
    const next = { ...get().liveNodeErrorsByNodeId };
    delete next[nodeId];
    set({ liveNodeErrorsByNodeId: next });
  },
  replaceNodeLiveErrorsByNodeId: (errorsByNodeId) =>
    set({ liveNodeErrorsByNodeId: errorsByNodeId }),
  clearCompilerErrors: () =>
    set({
      workflowErrors: [],
      liveNodeErrorsByNodeId: {},
    }),

  loadWorkflow: (nodes, edges) => {
    set({
      nodes,
      edges,
      selectedNodeId: null,
      workflowErrors: [],
      liveNodeErrorsByNodeId: {},
    });
  },
}));
