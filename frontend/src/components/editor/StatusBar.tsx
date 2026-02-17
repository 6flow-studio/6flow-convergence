"use client";

import { useEditorStore } from "@/lib/editor-store";
import type { CompilerActionStatus } from "@/lib/compiler/compiler-types";

interface StatusBarProps {
  saveStatus: "idle" | "saving" | "saved";
  compilerReady: boolean;
  compilerError: string | null;
  validationStatus: CompilerActionStatus;
  compileStatus: CompilerActionStatus;
}

export function StatusBar({
  saveStatus,
  compilerReady,
  compilerError,
  validationStatus,
  compileStatus,
}: StatusBarProps) {
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const workflowErrors = useEditorStore((s) => s.workflowErrors);
  const nodeErrors = useEditorStore((s) => s.liveNodeErrorsByNodeId);

  const nodeErrorCount = Object.values(nodeErrors).reduce(
    (count, errors) => count + errors.length,
    0
  );
  const statusDotClassName = compilerReady
    ? "bg-emerald-500 shadow-emerald-500/50"
    : "bg-red-500 shadow-red-500/50";
  const compilerLabel = compilerReady ? "Compiler Ready" : "Compiler Unavailable";

  return (
    <div className="h-7 bg-surface-1 border-t border-edge-dim flex items-center px-4 gap-5 text-[10px] text-zinc-600 shrink-0 select-none">
      <div className="flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full shadow-sm ${statusDotClassName}`} />
        <span>{compilerLabel}</span>
      </div>
      <div className="w-px h-3 bg-edge-dim" />
      <span>Save: {saveStatus}</span>
      <span>Validate: {validationStatus}</span>
      <span>Compile: {compileStatus}</span>
      <span>{nodes.length} nodes</span>
      <span>{edges.length} edges</span>
      <span>{workflowErrors.length} workflow issues</span>
      <span>{nodeErrorCount} node issues</span>
      {compilerError && <span className="text-red-400 truncate">{compilerError}</span>}
    </div>
  );
}
