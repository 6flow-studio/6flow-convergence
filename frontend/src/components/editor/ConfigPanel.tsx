"use client";

import { useEditorStore } from "@/lib/editor-store";
import { getNodeEntry, CATEGORY_COLORS } from "@/lib/node-registry";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Trash2, Settings2 } from "lucide-react";

export function ConfigPanel() {
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const nodes = useEditorStore((s) => s.nodes);
  const updateNodeConfig = useEditorStore((s) => s.updateNodeConfig);
  const updateNodeLabel = useEditorStore((s) => s.updateNodeLabel);
  const removeNode = useEditorStore((s) => s.removeNode);
  const selectNode = useEditorStore((s) => s.selectNode);

  if (!selectedNodeId) return null;

  const node = nodes.find((n) => n.id === selectedNodeId);
  if (!node) return null;

  const entry = getNodeEntry(node.data.nodeType);
  if (!entry) return null;

  const color = CATEGORY_COLORS[entry.category];
  const config = node.data.config;

  return (
    <div className="w-[280px] bg-surface-1 border-l border-edge-dim flex flex-col h-full shrink-0 animate-slide-in-right">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-edge-dim flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="text-[12px] font-semibold text-zinc-300">
            {node.data.label}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-zinc-600 hover:text-zinc-300 hover:bg-surface-3"
          onClick={() => selectNode(null)}
        >
          <X size={13} />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Node identity */}
          <div className="space-y-2">
            <label className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.08em] block">
              Label
            </label>
            <Input
              value={node.data.label}
              onChange={(e) => updateNodeLabel(node.id, e.target.value)}
              className="h-8 bg-surface-2 border-edge-dim text-zinc-200 text-[12px] hover:border-edge-bright focus:border-accent-blue transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="text-[10px] font-semibold border-0"
              style={{ backgroundColor: color + "18", color }}
            >
              {entry.category}
            </Badge>
            <span className="text-[11px] text-zinc-600">{entry.label}</span>
          </div>

          {/* Config fields */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 pt-1">
              <Settings2 size={11} className="text-zinc-600" />
              <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.08em]">
                Configuration
              </span>
            </div>

            <div className="space-y-2.5">
              {Object.entries(config).map(([key, value]) => (
                <div key={key}>
                  <label className="text-[11px] text-zinc-500 mb-1 block font-medium">
                    {key}
                  </label>
                  {typeof value === "string" ? (
                    <Input
                      value={value}
                      onChange={(e) =>
                        updateNodeConfig(node.id, { [key]: e.target.value })
                      }
                      className="h-8 bg-surface-2 border-edge-dim text-zinc-300 text-[12px] font-mono hover:border-edge-bright focus:border-accent-blue transition-colors"
                    />
                  ) : typeof value === "number" ? (
                    <Input
                      type="number"
                      value={value}
                      onChange={(e) =>
                        updateNodeConfig(node.id, {
                          [key]: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="h-8 bg-surface-2 border-edge-dim text-zinc-300 text-[12px] font-mono hover:border-edge-bright focus:border-accent-blue transition-colors"
                    />
                  ) : typeof value === "boolean" ? (
                    <button
                      onClick={() =>
                        updateNodeConfig(node.id, { [key]: !value })
                      }
                      className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors ${
                        value
                          ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                          : "bg-surface-3 text-zinc-500 hover:text-zinc-400"
                      }`}
                    >
                      {value ? "true" : "false"}
                    </button>
                  ) : (
                    <div className="text-[11px] text-zinc-600 bg-surface-2 border border-edge-dim rounded-md px-2.5 py-2 font-mono leading-relaxed break-all">
                      {JSON.stringify(value, null, 2).slice(0, 120)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Delete */}
          <div className="pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-red-500/60 hover:text-red-400 hover:bg-red-500/5 h-8 text-[11px] font-medium"
              onClick={() => {
                removeNode(node.id);
                selectNode(null);
              }}
            >
              <Trash2 size={12} className="mr-1.5" />
              Delete Node
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
