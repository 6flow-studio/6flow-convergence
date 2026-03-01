"use client";

/**
 * SYNC NOTE: The `renderNodeConfig` switch must stay aligned with
 * node types/configs in `shared/model/node.ts` (see checklist there).
 */
import { useEffect, useState, useCallback } from "react";
import { X, Trash2, AlertTriangle, Inbox, Clock } from "lucide-react";
import { useEditorStore, type WorkflowNode } from "@/lib/editor-store";
import { getNodeEntry, CATEGORY_COLORS } from "@/lib/node-registry";
import { isExecutionPreviewSupported } from "@/lib/node-execution/shared";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollapsibleSection, SchemaTree, PreviewCode } from "./config-fields";
import {
  CodeNodeConfigRenderer,
  HttpRequestConfigRenderer,
  HttpTriggerConfigRenderer,
  IfConfigRenderer,
  FilterConfigRenderer,
  AIConfigRenderer,
  GenericConfigRenderer,
  CronTriggerConfigRenderer,
  JsonParseConfigRenderer,
  ReturnConfigRenderer,
  ErrorConfigRenderer,
  EvmLogTriggerConfigRenderer,
  EvmReadConfigRenderer,
  EvmWriteConfigRenderer,
  AbiEncodeConfigRenderer,
  AbiDecodeConfigRenderer,
  MergeConfigRenderer,
} from "./config-renderers";
import { NodeExecutionPanel } from "./NodeExecutionPanel";
import type { NodeType } from "@6flow/shared/model/node";

function renderNodeConfig(
  nodeType: NodeType,
  config: Record<string, unknown>,
  onChange: (patch: Record<string, unknown>) => void,
  isTestnet?: boolean,
  secretNames?: string[]
) {
  const typedConfig = <T,>(value: Record<string, unknown>) => value as unknown as T;

  switch (nodeType) {
    case "codeNode":
      return (
        <CodeNodeConfigRenderer
          config={typedConfig<Parameters<typeof CodeNodeConfigRenderer>[0]["config"]>(config)}
          onChange={onChange}
        />
      );
    case "httpRequest":
      return (
        <HttpRequestConfigRenderer
          config={typedConfig<Parameters<typeof HttpRequestConfigRenderer>[0]["config"]>(config)}
          onChange={onChange}
        />
      );
    case "httpTrigger":
      return (
        <HttpTriggerConfigRenderer
          config={typedConfig<Parameters<typeof HttpTriggerConfigRenderer>[0]["config"]>(config)}
          onChange={onChange}
        />
      );
    case "if":
      return (
        <IfConfigRenderer
          config={typedConfig<Parameters<typeof IfConfigRenderer>[0]["config"]>(config)}
          onChange={onChange}
        />
      );
    case "filter":
      return (
        <FilterConfigRenderer
          config={typedConfig<Parameters<typeof FilterConfigRenderer>[0]["config"]>(config)}
          onChange={onChange}
        />
      );
    case "ai":
      return (
        <AIConfigRenderer
          config={typedConfig<Parameters<typeof AIConfigRenderer>[0]["config"]>(config)}
          onChange={onChange}
          secretNames={secretNames}
        />
      );
    case "cronTrigger":
      return (
        <CronTriggerConfigRenderer
          config={typedConfig<Parameters<typeof CronTriggerConfigRenderer>[0]["config"]>(config)}
          onChange={onChange}
        />
      );
    case "evmLogTrigger":
      return (
        <EvmLogTriggerConfigRenderer
          config={typedConfig<Parameters<typeof EvmLogTriggerConfigRenderer>[0]["config"]>(config)}
          onChange={onChange}
          isTestnet={isTestnet}
        />
      );
    case "evmRead":
      return (
        <EvmReadConfigRenderer
          config={typedConfig<Parameters<typeof EvmReadConfigRenderer>[0]["config"]>(config)}
          onChange={onChange}
          isTestnet={isTestnet}
        />
      );
    case "evmWrite":
      return (
        <EvmWriteConfigRenderer
          config={typedConfig<Parameters<typeof EvmWriteConfigRenderer>[0]["config"]>(config)}
          onChange={onChange}
          isTestnet={isTestnet}
        />
      );
    case "jsonParse":
      return (
        <JsonParseConfigRenderer
          config={typedConfig<Parameters<typeof JsonParseConfigRenderer>[0]["config"]>(config)}
          onChange={onChange}
        />
      );
    case "abiEncode":
      return (
        <AbiEncodeConfigRenderer
          config={typedConfig<Parameters<typeof AbiEncodeConfigRenderer>[0]["config"]>(config)}
          onChange={onChange}
        />
      );
    case "abiDecode":
      return (
        <AbiDecodeConfigRenderer
          config={typedConfig<Parameters<typeof AbiDecodeConfigRenderer>[0]["config"]>(config)}
          onChange={onChange}
        />
      );
    case "merge":
      return (
        <MergeConfigRenderer
          config={typedConfig<Parameters<typeof MergeConfigRenderer>[0]["config"]>(config)}
          onChange={onChange}
        />
      );
    case "return":
      return (
        <ReturnConfigRenderer
          config={typedConfig<Parameters<typeof ReturnConfigRenderer>[0]["config"]>(config)}
          onChange={onChange}
        />
      );
    case "error":
      return (
        <ErrorConfigRenderer
          config={typedConfig<Parameters<typeof ErrorConfigRenderer>[0]["config"]>(config)}
          onChange={onChange}
        />
      );
    default:
      return <GenericConfigRenderer config={config} onChange={onChange} />;
  }
}

export function NodeDetailsModal() {
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const updateNodeConfig = useEditorStore((s) => s.updateNodeConfig);
  const updateNodeLabel = useEditorStore((s) => s.updateNodeLabel);
  const removeNode = useEditorStore((s) => s.removeNode);
  const selectNode = useEditorStore((s) => s.selectNode);
  const liveNodeErrorsByNodeId = useEditorStore((s) => s.liveNodeErrorsByNodeId);
  const workflowGlobalConfig = useEditorStore((s) => s.workflowGlobalConfig);

  const [activeUpstreamIndex, setActiveUpstreamIndex] = useState(0);

  // Reset upstream tab when selected node changes
  useEffect(() => {
    setActiveUpstreamIndex(0);
  }, [selectedNodeId]);

  const close = useCallback(() => selectNode(null), [selectNode]);

  // Escape key handler
  useEffect(() => {
    if (!selectedNodeId) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedNodeId, close]);

  if (!selectedNodeId) return null;

  const node = nodes.find((n) => n.id === selectedNodeId);
  if (!node) return null;

  const entry = getNodeEntry(node.data.nodeType);
  if (!entry) return null;

  const color = CATEGORY_COLORS[entry.category];
  const config = node.data.config;
  const nodeErrors = liveNodeErrorsByNodeId[node.id] ?? [];

  // Derive upstream nodes
  const upstreamEdges = edges.filter((e) => e.target === selectedNodeId);
  const upstreamNodes = upstreamEdges
    .map((e) => nodes.find((n) => n.id === e.source))
    .filter((n): n is WorkflowNode => n != null);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="w-[90vw] h-[90vh] max-w-[1600px] rounded-xl border border-edge-dim bg-surface-1 shadow-2xl flex flex-col overflow-hidden">
        {/* Modal header */}
        <div className="px-4 py-3 border-b border-edge-dim flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-sm font-semibold text-zinc-200 truncate">
              {node.data.label}
            </span>
            <Badge
              variant="secondary"
              className="text-[10px] font-semibold border-0 shrink-0"
              style={{ backgroundColor: color + "18", color }}
            >
              {entry.category}
            </Badge>
            <span className="text-[11px] text-zinc-500 shrink-0">{entry.label}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500/60 hover:text-red-400 hover:bg-red-500/5 h-7 text-[11px] font-medium"
              onClick={() => {
                removeNode(node.id);
                selectNode(null);
              }}
            >
              <Trash2 size={12} className="mr-1" />
              Delete
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-zinc-500 hover:text-zinc-300 hover:bg-surface-3"
              onClick={close}
            >
              <X size={14} />
            </Button>
          </div>
        </div>

        {/* Three-column body */}
        <div className="flex flex-1 min-h-0 divide-x divide-edge-dim">
          {/* INPUT column */}
          <div className="w-[30%] flex flex-col min-h-0">
            <div className="px-3 py-2 border-b border-edge-dim shrink-0">
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.08em]">
                Input
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <InputColumn
                upstreamNodes={upstreamNodes}
                activeIndex={activeUpstreamIndex}
                onChangeIndex={setActiveUpstreamIndex}
              />
            </div>
          </div>

          {/* CONFIG column */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-3 py-2 border-b border-edge-dim shrink-0">
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.08em]">
                Parameters
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {/* Label */}
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

              {/* Validation errors */}
              {nodeErrors.length > 0 && (
                <div className="rounded-md border border-red-500/25 bg-red-500/10 px-2.5 py-2 space-y-1">
                  <div className="flex items-center gap-1.5 text-red-300 text-[11px] font-semibold">
                    <AlertTriangle size={12} />
                    <span>{nodeErrors.length} validation issue(s)</span>
                  </div>
                  {nodeErrors.map((error, index) => (
                    <div key={`${error.code}-${index}`} className="text-[11px] text-zinc-300 leading-relaxed">
                      <span className="text-red-300">[{error.phase}:{error.code}]</span>{" "}
                      {error.message}
                    </div>
                  ))}
                </div>
              )}

              {/* Config renderers */}
              {renderNodeConfig(
                node.data.nodeType,
                config,
                (patch) => updateNodeConfig(node.id, patch),
                workflowGlobalConfig.isTestnet,
                workflowGlobalConfig.secrets.map((s) => s.name).filter(Boolean)
              )}
            </div>
          </div>

          {/* OUTPUT column */}
          <div className="w-[30%] flex flex-col min-h-0">
            <div className="px-3 py-2 border-b border-edge-dim shrink-0">
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.08em]">
                Output
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {isExecutionPreviewSupported(node.data.nodeType) ? (
                <NodeExecutionPanel node={node} />
              ) : (
                <EmptyState
                  icon={<Inbox size={24} className="text-zinc-600" />}
                  message="Execution preview not available for this node type"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── INPUT column content ────────────────────────────────── */

function InputColumn({
  upstreamNodes,
  activeIndex,
  onChangeIndex,
}: {
  upstreamNodes: WorkflowNode[];
  activeIndex: number;
  onChangeIndex: (i: number) => void;
}) {
  if (upstreamNodes.length === 0) {
    return (
      <EmptyState
        icon={<Inbox size={24} className="text-zinc-600" />}
        message="No input — this node starts the workflow"
      />
    );
  }

  const safeIndex = Math.min(activeIndex, upstreamNodes.length - 1);
  const upstream = upstreamNodes[safeIndex];

  return (
    <div className="space-y-3">
      {/* Tab strip for multiple upstreams */}
      {upstreamNodes.length > 1 && (
        <div className="flex gap-1 flex-wrap">
          {upstreamNodes.map((n, i) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onChangeIndex(i)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                i === safeIndex
                  ? "bg-accent-blue/15 text-accent-blue"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-surface-2"
              }`}
            >
              {n.data.label}
            </button>
          ))}
        </div>
      )}

      <UpstreamPreview node={upstream} />
    </div>
  );
}

function UpstreamPreview({ node }: { node: WorkflowNode }) {
  const execution = node.data.editor?.lastExecution;
  const schema = node.data.editor?.outputSchema;
  const entry = getNodeEntry(node.data.nodeType);
  const isTrigger = entry?.category === "trigger";

  if (!execution) {
    if (isTrigger) {
      return (
        <EmptyState
          icon={<Inbox size={24} className="text-zinc-600" />}
          message={`"${node.data.label}" is a trigger node and does not produce output data`}
        />
      );
    }
    return (
      <EmptyState
        icon={<Clock size={20} className="text-amber-400/60" />}
        message={`Run "${node.data.label}" first to see input data`}
        variant="amber"
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className="border-0 bg-emerald-500/15 text-[10px] font-semibold text-emerald-300"
        >
          from: {node.data.label}
        </Badge>
      </div>

      {schema && (
        <CollapsibleSection label="Output Schema" defaultOpen>
          <SchemaTree schema={schema} />
        </CollapsibleSection>
      )}

      <CollapsibleSection label="Normalized Output" defaultOpen>
        <PreviewCode value={execution.normalized} />
      </CollapsibleSection>

      <CollapsibleSection label="Raw Output">
        <PreviewCode value={execution.raw} />
      </CollapsibleSection>
    </div>
  );
}

/* ── Shared empty state ──────────────────────────────────── */

function EmptyState({
  icon,
  message,
  variant = "default",
}: {
  icon: React.ReactNode;
  message: string;
  variant?: "default" | "amber";
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      {icon}
      <p
        className={`text-[11px] leading-relaxed max-w-[200px] ${
          variant === "amber" ? "text-amber-200/70" : "text-zinc-500"
        }`}
      >
        {message}
      </p>
    </div>
  );
}
