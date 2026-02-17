"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEditorStore } from "./editor-store";
import { toReactFlowNodes, fromReactFlowNodes } from "./workflow-convert";
import type { Id } from "../../convex/_generated/dataModel";
import {
  DEFAULT_WORKFLOW_GLOBAL_CONFIG,
  cloneGlobalConfig,
} from "./workflow-defaults";

type SaveStatus = "idle" | "saving" | "saved";

const DEBOUNCE_MS = 1500;

export function useWorkflowPersistence(workflowId: string) {
  const id = workflowId as Id<"workflows">;
  const workflow = useQuery(api.workflows.load, { id });
  const saveMutation = useMutation(api.workflows.save);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const hydrated = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPersistedSnapshot = useRef<string>("");

  const buildPersistedSnapshot = useCallback(() => {
    const state = useEditorStore.getState();
    const snapshot = {
      name: state.workflowName,
      nodes: fromReactFlowNodes(state.nodes),
      edges: state.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
      })),
      globalConfig: state.workflowGlobalConfig,
    };
    return JSON.stringify(snapshot);
  }, []);

  // Hydrate store from Convex on first load
  useEffect(() => {
    if (hydrated.current || !workflow) return;

    const store = useEditorStore.getState();
    store.setWorkflowName(workflow.name);
    store.setWorkflowId(workflow._id);
    store.setWorkflowCreatedAt(new Date(workflow._creationTime).toISOString());

    try {
      const parsedNodes = JSON.parse(workflow.nodes);
      const parsedEdges = JSON.parse(workflow.edges);
      store.loadWorkflow(toReactFlowNodes(parsedNodes), parsedEdges);
    } catch {
      store.loadWorkflow([], []);
    }

    try {
      const parsedGlobalConfig = workflow.globalConfig
        ? JSON.parse(workflow.globalConfig)
        : DEFAULT_WORKFLOW_GLOBAL_CONFIG;
      store.setWorkflowGlobalConfig(parsedGlobalConfig);
    } catch {
      store.setWorkflowGlobalConfig(
        cloneGlobalConfig(DEFAULT_WORKFLOW_GLOBAL_CONFIG)
      );
    }

    lastPersistedSnapshot.current = buildPersistedSnapshot();
    hydrated.current = true;
  }, [buildPersistedSnapshot, workflow]);

  const save = useCallback(async () => {
    const { workflowName, nodes, edges, workflowGlobalConfig } =
      useEditorStore.getState();
    const persistedSnapshot = JSON.stringify({
      name: workflowName,
      nodes: fromReactFlowNodes(nodes),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
      })),
      globalConfig: workflowGlobalConfig,
    });

    setSaveStatus("saving");
    try {
      await saveMutation({
        id,
        name: workflowName,
        nodes: JSON.stringify(fromReactFlowNodes(nodes)),
        edges: JSON.stringify(edges),
        globalConfig: JSON.stringify(workflowGlobalConfig),
      });
      lastPersistedSnapshot.current = persistedSnapshot;
      setSaveStatus("saved");
    } catch {
      setSaveStatus("idle");
    }
  }, [id, saveMutation]);

  // Debounced auto-save on store changes
  useEffect(() => {
    const unsub = useEditorStore.subscribe(() => {
      if (!hydrated.current) return;
      const currentSnapshot = buildPersistedSnapshot();
      if (currentSnapshot === lastPersistedSnapshot.current) {
        return;
      }

      if (timerRef.current) clearTimeout(timerRef.current);
      setSaveStatus("idle");
      timerRef.current = setTimeout(() => {
        void save();
      }, DEBOUNCE_MS);
    });

    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [buildPersistedSnapshot, save]);

  return { saveStatus, isLoading: workflow === undefined };
}
