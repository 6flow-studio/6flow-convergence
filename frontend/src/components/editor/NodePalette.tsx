"use client";

import { useState } from "react";
import * as Icons from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  getNodesByCategory,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  type NodeRegistryEntry,
} from "@/lib/node-registry";

type LucideIcon = React.ComponentType<{ size?: number; className?: string }>;

function getIcon(iconName: string): LucideIcon {
  const Icon = (Icons as unknown as Record<string, LucideIcon>)[iconName];
  return Icon || Icons.Box;
}

function PaletteItem({ entry }: { entry: NodeRegistryEntry }) {
  const Icon = getIcon(entry.icon);

  function onDragStart(event: React.DragEvent) {
    event.dataTransfer.setData("application/6flow-node-type", entry.type);
    event.dataTransfer.effectAllowed = "move";
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="flex items-center gap-2.5 px-2.5 py-[7px] rounded-md cursor-grab active:cursor-grabbing hover:bg-surface-3 transition-all duration-100 group mx-1"
    >
      <div
        className="w-[26px] h-[26px] rounded-[5px] flex items-center justify-center shrink-0 transition-transform duration-100 group-hover:scale-110"
        style={{ backgroundColor: entry.color + "15", color: entry.color }}
      >
        <Icon size={13} />
      </div>
      <span className="text-[12px] text-zinc-400 group-hover:text-zinc-200 truncate transition-colors font-medium">
        {entry.label}
      </span>
    </div>
  );
}

export function NodePalette() {
  const [search, setSearch] = useState("");
  const grouped = getNodesByCategory();

  const filteredGroups = Object.entries(grouped)
    .map(([category, entries]) => {
      const filtered = entries.filter((e) =>
        e.label.toLowerCase().includes(search.toLowerCase())
      );
      return [category, filtered] as const;
    })
    .filter(([, entries]) => entries.length > 0);

  return (
    <div className="w-[232px] bg-surface-1 border-r border-edge-dim flex flex-col h-full shrink-0">
      <div className="p-3 border-b border-edge-dim">
        <div className="flex items-center gap-2 mb-2.5">
          <Icons.Blocks size={14} className="text-zinc-500" />
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Nodes
          </span>
        </div>
        <div className="relative">
          <Icons.Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none"
          />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 bg-surface-2 border-edge-dim text-zinc-300 text-[12px] placeholder:text-zinc-600 pl-8 hover:border-edge-bright focus:border-accent-blue transition-colors"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="py-2">
          {filteredGroups.map(([category, entries]) => (
            <div key={category} className="mb-1">
              <div className="flex items-center gap-2 px-3.5 py-[6px]">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] }}
                />
                <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.08em]">
                  {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
                </span>
              </div>
              {entries.map((entry) => (
                <PaletteItem key={entry.type} entry={entry} />
              ))}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
