"use client";

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { useEditorStore } from "@/lib/editor-store";

interface CompilerErrorsPanelProps {
  className?: string;
}

export function CompilerErrorsPanel({ className }: CompilerErrorsPanelProps) {
  const workflowErrors = useEditorStore((state) => state.workflowErrors);
  const liveNodeErrorsByNodeId = useEditorStore(
    (state) => state.liveNodeErrorsByNodeId
  );
  const selectNode = useEditorStore((state) => state.selectNode);

  const liveNodeEntries = useMemo(
    () => Object.entries(liveNodeErrorsByNodeId).filter(([, errors]) => errors.length > 0),
    [liveNodeErrorsByNodeId]
  );

  const hasWorkflowErrors = workflowErrors.length > 0;
  const visibleLiveNodeEntries = hasWorkflowErrors ? [] : liveNodeEntries;
  const totalErrors = hasWorkflowErrors
    ? workflowErrors.length
    : visibleLiveNodeEntries.reduce((count, [, errors]) => count + errors.length, 0);

  const panelClassName = [
    "border-t border-edge-dim bg-surface-1/80 h-40 shrink-0",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={panelClassName}>
      <div className="h-8 border-b border-edge-dim px-4 flex items-center gap-2 text-[11px] text-zinc-400">
        <AlertTriangle size={12} className={totalErrors > 0 ? "text-amber-400" : "text-zinc-600"} />
        <span className="font-medium">Compiler Errors</span>
        <span className="text-zinc-600">{totalErrors}</span>
      </div>

      <div className="h-[calc(100%-2rem)] overflow-auto px-4 py-2 text-[11px] space-y-3">
        {totalErrors === 0 ? (
          <div className="text-zinc-600">No compiler errors.</div>
        ) : (
          <>
            {workflowErrors.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-zinc-500 uppercase tracking-[0.08em] text-[10px]">
                  Workflow Validation and Compile
                </p>
                {workflowErrors.map((error, index) => (
                  <button
                    key={`${error.code}-${error.node_id ?? "workflow"}-${index}`}
                    className="w-full text-left rounded-md border border-red-500/20 bg-red-500/5 px-2 py-1.5 hover:bg-red-500/10 transition-colors"
                    onClick={() => {
                      if (error.node_id) {
                        selectNode(error.node_id);
                      }
                    }}
                  >
                    <div className="text-red-300 font-medium">
                      [{error.phase}:{error.code}] {error.node_id ? `node ${error.node_id}` : "workflow"}
                    </div>
                    <div className="text-zinc-300 mt-0.5">{error.message}</div>
                  </button>
                ))}
              </div>
            )}

            {visibleLiveNodeEntries.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-zinc-500 uppercase tracking-[0.08em] text-[10px]">
                  Live Node Validation
                </p>
                {visibleLiveNodeEntries.map(([nodeId, errors]) => (
                  <button
                    key={nodeId}
                    className="w-full text-left rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 hover:bg-amber-500/10 transition-colors"
                    onClick={() => selectNode(nodeId)}
                  >
                    <div className="text-amber-300 font-medium">node {nodeId}</div>
                    {errors.map((error, index) => (
                      <div key={`${error.code}-${index}`} className="text-zinc-300 mt-0.5">
                        [{error.phase}:{error.code}] {error.message}
                      </div>
                    ))}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
