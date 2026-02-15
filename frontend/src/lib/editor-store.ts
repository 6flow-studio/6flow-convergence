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
import { getNodeEntry } from "./node-registry";
import { createDefaultGlobalConfig } from "./workflow-global-config";

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
  globalConfig: GlobalConfig;

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
  setGlobalConfig: (patch: Partial<GlobalConfig>) => void;
  loadWorkflow: (nodes: WorkflowNode[], edges: WorkflowEdge[], globalConfig: GlobalConfig) => void;
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
  globalConfig: createDefaultGlobalConfig(),

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
  setGlobalConfig: (patch) => {
    set({
      globalConfig: {
        ...get().globalConfig,
        ...patch,
      },
    });
  },

  loadWorkflow: (nodes, edges, globalConfig) => {
    set({ nodes, edges, globalConfig, selectedNodeId: null });
  },
}));
