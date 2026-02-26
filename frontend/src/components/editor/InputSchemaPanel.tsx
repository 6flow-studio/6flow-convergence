"use client";

import { useState } from "react";
import { ChevronRight, Plus, Zap } from "lucide-react";
import { CATEGORY_COLORS } from "@/lib/node-registry";
import { NODE_TYPE_TO_CATEGORY } from "@6flow/shared/model/node";
import type { UpstreamNodeInfo } from "@/lib/upstream-resolver";
import { useExpressionInsert } from "@/lib/expression-insert-context";

interface InputSchemaPanelProps {
  upstreamNodes: UpstreamNodeInfo[];
}

export function InputSchemaPanel({ upstreamNodes }: InputSchemaPanelProps) {
  const expressionInsert = useExpressionInsert();

  if (upstreamNodes.length === 0) {
    return (
      <div className="text-[11px] text-zinc-600 italic px-1">
        No upstream nodes connected
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {upstreamNodes.map((upstream) => (
        <UpstreamNodeGroup
          key={upstream.nodeId}
          upstream={upstream}
          onInsert={(ref) => expressionInsert?.insertReference(ref)}
        />
      ))}
    </div>
  );
}

function UpstreamNodeGroup({
  upstream,
  onInsert,
}: {
  upstream: UpstreamNodeInfo;
  onInsert: (ref: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const category = NODE_TYPE_TO_CATEGORY[upstream.nodeType];
  const color = CATEGORY_COLORS[category];
  const isDynamic = upstream.schemaMode === "dynamic";

  return (
    <div className="border border-edge-dim rounded-md overflow-hidden">
      {/* Node header */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full px-2 py-1.5 text-left bg-surface-2 hover:bg-surface-3 transition-colors"
      >
        <ChevronRight
          size={11}
          className={`text-zinc-500 transition-transform shrink-0 ${open ? "rotate-90" : ""}`}
        />
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-[11px] font-medium text-zinc-300 truncate">
          {upstream.nodeLabel}
        </span>
        <span className="text-[10px] text-zinc-600 ml-auto shrink-0">
          {upstream.nodeId}
        </span>
      </button>

      {/* Fields */}
      {open && (
        <div className="bg-surface-1">
          {isDynamic ? (
            <div className="flex items-center gap-1.5 px-2.5 py-2 text-[10px] text-zinc-500 italic border-t border-edge-dim/50">
              <Zap size={10} className="text-yellow-500/60" />
              Dynamic output
            </div>
          ) : upstream.fields.length === 0 ? (
            <div className="px-2.5 py-2 text-[10px] text-zinc-600 italic border-t border-edge-dim/50">
              No output fields
            </div>
          ) : (
            upstream.fields.map((field) => (
              <button
                key={field.name}
                type="button"
                className="flex items-center gap-2 w-full px-2.5 py-1 text-left hover:bg-surface-3 transition-colors group border-t border-edge-dim/50"
                onClick={() => onInsert(`{{${upstream.nodeId}.${field.name}}}`)}
                title={field.description ?? `Insert {{${upstream.nodeId}.${field.name}}}`}
              >
                <span className="text-[11px] font-mono text-zinc-300">
                  {field.name}
                </span>
                <span className="text-[10px] text-zinc-600">{field.type}</span>
                <Plus
                  size={10}
                  className="ml-auto text-zinc-700 group-hover:text-accent-blue transition-colors shrink-0"
                />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
