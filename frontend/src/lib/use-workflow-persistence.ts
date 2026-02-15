"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEditorStore } from "./editor-store";
import { toReactFlowNodes, fromReactFlowNodes } from "./workflow-convert";
import { createDefaultGlobalConfig, sanitizeGlobalConfig } from "./workflow-global-config";
import type { Id } from "../../convex/_generated/dataModel";

type SaveStatus = "idle" | "saving" | "saved";

const DEBOUNCE_MS = 1500;

export function useWorkflowPersistence(workflowId: string) {
  const id = workflowId as Id<"workflows">;
  const workflow = useQuery(api.workflows.load, { id });
  const saveMutation = useMutation(api.workflows.save);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const hydrated = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate store from Convex on first load
  useEffect(() => {
    if (hydrated.current || !workflow) return;
    hydrated.current = true;

    const store = useEditorStore.getState();
    store.setWorkflowName(workflow.name);
    store.setWorkflowId(workflow._id);

    const defaultGlobalConfig = createDefaultGlobalConfig();
    let parsedGlobalConfig = defaultGlobalConfig;
    if (workflow.globalConfig) {
      try {
        parsedGlobalConfig = sanitizeGlobalConfig(JSON.parse(workflow.globalConfig));
      } catch {
        parsedGlobalConfig = defaultGlobalConfig;
      }
    }

    try {
      const parsedNodes = JSON.parse(workflow.nodes);
      const parsedEdges = JSON.parse(workflow.edges);
      store.loadWorkflow(toReactFlowNodes(parsedNodes), parsedEdges, parsedGlobalConfig);
    } catch {
      store.loadWorkflow([], [], parsedGlobalConfig);
    }
  }, [workflow]);

  const save = useCallback(async () => {
    const { workflowName, nodes, edges, globalConfig } = useEditorStore.getState();
    setSaveStatus("saving");
    try {
      await saveMutation({
        id,
        name: workflowName,
        nodes: JSON.stringify(fromReactFlowNodes(nodes)),
        edges: JSON.stringify(edges),
        globalConfig: JSON.stringify(globalConfig),
      });
      setSaveStatus("saved");
    } catch {
      setSaveStatus("idle");
    }
  }, [id, saveMutation]);

  // Debounced auto-save on store changes
  useEffect(() => {
    const unsub = useEditorStore.subscribe(() => {
      if (!hydrated.current) return;

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
  }, [save]);

  return { saveStatus, isLoading: workflow === undefined };
}
