"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import * as Icons from "lucide-react";
import { getNodeEntry, type NodeCategory } from "@/lib/node-registry";
import type { WorkflowNodeData } from "@/lib/editor-store";
import { useEditorStore } from "@/lib/editor-store";
import { CATEGORY_NODE_STYLES, HANDLE_STYLE } from "./node-styles";

type LucideIcon = React.ComponentType<{ size?: number; className?: string }>;

function getIcon(iconName: string): LucideIcon {
  const Icon = (Icons as unknown as Record<string, LucideIcon>)[iconName];
  return Icon || Icons.Box;
}

export function BaseNodeComponent({
  id,
  data,
  selected,
  category,
}: NodeProps & { category: NodeCategory }) {
  const nodeData = data as unknown as WorkflowNodeData;
  const entry = getNodeEntry(nodeData.nodeType);
  const styles = CATEGORY_NODE_STYLES[category];
  const Icon = getIcon(entry?.icon || "Box");
  const inputs = entry?.inputs || [];
  const outputs = entry?.outputs || [];
  const errorCount = useEditorStore(
    (state) => state.liveNodeErrorsByNodeId[id]?.length ?? 0
  );
  const hasErrors = errorCount > 0;

  return (
    <div
      className={`
        relative min-w-[172px] rounded-lg border shadow-lg
        ${styles.bg} ${styles.border} ${styles.glow}
        ${selected ? "ring-1 ring-white/20 shadow-xl shadow-white/5" : ""}
        ${hasErrors ? "ring-1 ring-red-400/60 shadow-red-900/30" : ""}
        transition-all duration-150
        hover:shadow-xl
      `}
    >
      {hasErrors && (
        <div className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border border-surface-1 z-20">
          {errorCount}
        </div>
      )}

      {inputs.map((input, i) => (
        <Handle
          key={input.name}
          type="target"
          position={Position.Left}
          id={input.name}
          style={{
            ...HANDLE_STYLE,
            top: inputs.length === 1 ? "50%" : `${((i + 1) / (inputs.length + 1)) * 100}%`,
          }}
        />
      ))}

      <div className={`${styles.headerBg} rounded-t-[7px] px-3 py-[7px] flex items-center gap-2`}>
        <Icon size={13} className={`${styles.headerText} shrink-0 opacity-90`} />
        <span className={`text-[11px] font-semibold ${styles.headerText} truncate leading-tight`}>
          {nodeData.label}
        </span>
      </div>

      <div className="px-3 py-2">
        <span className={`text-[10px] ${styles.bodyText} font-medium`}>
          {entry?.label}
        </span>
      </div>

      {outputs.map((output, i) => (
        <Handle
          key={output.name}
          type="source"
          position={Position.Right}
          id={output.name}
          style={{
            ...HANDLE_STYLE,
            top: outputs.length === 1 ? "50%" : `${((i + 1) / (outputs.length + 1)) * 100}%`,
          }}
        />
      ))}
    </div>
  );
}
