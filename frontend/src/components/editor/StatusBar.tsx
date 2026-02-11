"use client";

import { useEditorStore } from "@/lib/editor-store";

export function StatusBar() {
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);

  return (
    <div className="h-7 bg-surface-1 border-t border-edge-dim flex items-center px-4 gap-5 text-[10px] text-zinc-600 shrink-0 select-none">
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
        <span>Ready</span>
      </div>
      <div className="w-px h-3 bg-edge-dim" />
      <span>{nodes.length} nodes</span>
      <span>{edges.length} edges</span>
    </div>
  );
}
