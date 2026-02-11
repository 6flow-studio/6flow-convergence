"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useEditorStore } from "./editor-store";
import type { Id } from "../../../convex/_generated/dataModel";

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
    try {
      store.loadWorkflow(
        JSON.parse(workflow.nodes),
        JSON.parse(workflow.edges)
      );
    } catch {
      // ignore parse errors
    }
  }, [workflow]);

  const save = useCallback(async () => {
    const { workflowName, nodes, edges } = useEditorStore.getState();
    setSaveStatus("saving");
    try {
      await saveMutation({
        id,
        name: workflowName,
        nodes: JSON.stringify(nodes),
        edges: JSON.stringify(edges),
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
