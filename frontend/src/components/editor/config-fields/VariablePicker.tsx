"use client";

import { useState } from "react";
import { useScopedVariables } from "@/hooks/useScopedVariables";

interface VariablePickerProps {
  onInsert: (expr: string) => void;
}

export function VariablePicker({ onInsert }: VariablePickerProps) {
  const [open, setOpen] = useState(false);
  const variables = useScopedVariables();

  if (variables.length === 0) return null;

  // Group by source node
  const bySource: Record<string, typeof variables> = {};
  for (const v of variables) {
    if (!bySource[v.source]) bySource[v.source] = [];
    bySource[v.source].push(v);
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()} // prevent stealing focus from input
        onClick={() => setOpen((o) => !o)}
        className="h-8 px-2 text-[11px] font-mono text-zinc-500 hover:text-zinc-300 hover:bg-surface-3 border border-edge-dim rounded-md transition-colors"
        title="Insert variable"
      >
        {"{·}"}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[220px] max-h-[260px] overflow-y-auto rounded-md border border-edge-dim bg-surface-1 shadow-xl">
            {Object.entries(bySource).map(([source, vars]) => (
              <div key={source}>
                <div className="px-2.5 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.08em] bg-surface-2 sticky top-0">
                  {source}
                </div>
                {vars.map((v) => (
                  <button
                    key={v.expression}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onInsert(v.expression);
                      setOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-surface-3 transition-colors"
                  >
                    <span className="font-mono text-[11px] text-zinc-300">{v.name}</span>
                    <span className="text-[10px] text-zinc-600 ml-auto">{v.type}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
