"use client";

/**
 * SYNC NOTE: The `renderNodeConfig` switch must stay aligned with
 * node types/configs in `shared/model/node.ts` (see checklist there).
 */
import { useRef, useState, useCallback, useEffect } from "react";
import { useEditorStore } from "@/lib/editor-store";
import { getNodeEntry, CATEGORY_COLORS } from "@/lib/node-registry";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Trash2, Settings2 } from "lucide-react";
import type { NodeType } from "@6flow/shared/model/node";
import {
  CodeNodeConfigRenderer,
  HttpRequestConfigRenderer,
  HttpTriggerConfigRenderer,
  IfConfigRenderer,
  FilterConfigRenderer,
  AIConfigRenderer,
  GenericConfigRenderer,
  CronTriggerConfigRenderer,
  GetSecretConfigRenderer,
  JsonParseConfigRenderer,
  ReturnConfigRenderer,
  LogConfigRenderer,
  ErrorConfigRenderer,
  CheckKycConfigRenderer,
  TokenNodeConfigRenderer,
  CheckBalanceConfigRenderer,
  EvmLogTriggerConfigRenderer,
  EvmReadConfigRenderer,
  EvmWriteConfigRenderer,
  AbiEncodeConfigRenderer,
  AbiDecodeConfigRenderer,
  MergeConfigRenderer,
} from "./config-renderers";

function renderNodeConfig(
  nodeType: NodeType,
  config: Record<string, unknown>,
  onChange: (patch: Record<string, unknown>) => void
) {
  switch (nodeType) {
    case "codeNode":
      return <CodeNodeConfigRenderer config={config as any} onChange={onChange} />;
    case "httpRequest":
      return <HttpRequestConfigRenderer config={config as any} onChange={onChange} />;
    case "httpTrigger":
      return <HttpTriggerConfigRenderer config={config as any} onChange={onChange} />;
    case "if":
      return <IfConfigRenderer config={config as any} onChange={onChange} />;
    case "filter":
      return <FilterConfigRenderer config={config as any} onChange={onChange} />;
    case "ai":
      return <AIConfigRenderer config={config as any} onChange={onChange} />;
    case "cronTrigger":
      return <CronTriggerConfigRenderer config={config as any} onChange={onChange} />;
    case "evmLogTrigger":
      return <EvmLogTriggerConfigRenderer config={config as any} onChange={onChange} />;
    case "evmRead":
      return <EvmReadConfigRenderer config={config as any} onChange={onChange} />;
    case "evmWrite":
      return <EvmWriteConfigRenderer config={config as any} onChange={onChange} />;
    case "getSecret":
      return <GetSecretConfigRenderer config={config as any} onChange={onChange} />;
    case "jsonParse":
      return <JsonParseConfigRenderer config={config as any} onChange={onChange} />;
    case "abiEncode":
      return <AbiEncodeConfigRenderer config={config as any} onChange={onChange} />;
    case "abiDecode":
      return <AbiDecodeConfigRenderer config={config as any} onChange={onChange} />;
    case "merge":
      return <MergeConfigRenderer config={config as any} onChange={onChange} />;
    case "return":
      return <ReturnConfigRenderer config={config as any} onChange={onChange} />;
    case "log":
      return <LogConfigRenderer config={config as any} onChange={onChange} />;
    case "error":
      return <ErrorConfigRenderer config={config as any} onChange={onChange} />;
    case "mintToken":
      return <TokenNodeConfigRenderer variant="mint" config={config as any} onChange={onChange} />;
    case "burnToken":
      return <TokenNodeConfigRenderer variant="burn" config={config as any} onChange={onChange} />;
    case "transferToken":
      return <TokenNodeConfigRenderer variant="transfer" config={config as any} onChange={onChange} />;
    case "checkKyc":
      return <CheckKycConfigRenderer config={config as any} onChange={onChange} />;
    case "checkBalance":
      return <CheckBalanceConfigRenderer config={config as any} onChange={onChange} />;
    default:
      return <GenericConfigRenderer config={config} onChange={onChange} />;
  }
}

const MIN_WIDTH = 280;
const MAX_WIDTH = 600;

export function ConfigPanel() {
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const nodes = useEditorStore((s) => s.nodes);
  const updateNodeConfig = useEditorStore((s) => s.updateNodeConfig);
  const updateNodeLabel = useEditorStore((s) => s.updateNodeLabel);
  const removeNode = useEditorStore((s) => s.removeNode);
  const selectNode = useEditorStore((s) => s.selectNode);

  const [width, setWidth] = useState(MIN_WIDTH);
  const isResizing = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const startX = e.clientX;
    const startWidth = width;

    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX - e.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
      setWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [width]);

  if (!selectedNodeId) return null;

  const node = nodes.find((n) => n.id === selectedNodeId);
  if (!node) return null;

  const entry = getNodeEntry(node.data.nodeType);
  if (!entry) return null;

  const color = CATEGORY_COLORS[entry.category];
  const config = node.data.config;

  return (
    <div
      style={{ width }}
      className="bg-surface-1 border-l border-edge-dim flex flex-col h-full shrink-0 animate-slide-in-right relative"
    >
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent-blue/40 transition-colors z-10"
        onMouseDown={onMouseDown}
      />
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

            {renderNodeConfig(
              node.data.nodeType,
              config,
              (patch) => updateNodeConfig(node.id, patch)
            )}
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
