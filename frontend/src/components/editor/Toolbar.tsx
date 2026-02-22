"use client";

import type {
  Workflow as SharedWorkflow,
  WorkflowEdge as SharedWorkflowEdge,
} from "@6flow/shared/model/node";
import {
  ArrowLeft,
  CheckCircle,
  Cloud,
  CloudOff,
  Download,
  Loader2,
  Play,
  SlidersHorizontal,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CompilerActionStatus } from "@/lib/compiler/compiler-types";
import { useEditorStore } from "@/lib/editor-store";
import { fromReactFlowNodes } from "@/lib/workflow-convert";

interface ToolbarProps {
  saveStatus: "idle" | "saving" | "saved";
  canRunCompiler: boolean;
  validationStatus: CompilerActionStatus;
  compileStatus: CompilerActionStatus;
  validationMessage: string | null;
  compileMessage: string | null;
  onValidate: () => void;
  onCompile: () => void;
  onOpenSettings: () => void;
}

export function Toolbar({
  saveStatus,
  canRunCompiler,
  validationStatus,
  compileStatus,
  validationMessage,
  compileMessage,
  onValidate,
  onCompile,
  onOpenSettings,
}: ToolbarProps) {
  const workflowName = useEditorStore((s) => s.workflowName);
  const workflowId = useEditorStore((s) => s.workflowId);
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const workflowGlobalConfig = useEditorStore((s) => s.workflowGlobalConfig);
  const setWorkflowName = useEditorStore((s) => s.setWorkflowName);
  const isBusy = validationStatus === "running" || compileStatus === "running";
  const validateLabel =
    validationStatus === "running" ? "Validating..." : "Validate";
  const compileLabel = compileStatus === "running" ? "Compiling..." : "Compile";
  const compilerHint = compileMessage ?? validationMessage;

  const handleDownloadJson = () => {
    const timestampIso = new Date().toISOString();
    const exportedEdges: SharedWorkflowEdge[] = edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      ...(edge.sourceHandle ? { sourceHandle: edge.sourceHandle } : {}),
      ...(edge.targetHandle ? { targetHandle: edge.targetHandle } : {}),
    }));

    const workflowJson: SharedWorkflow = {
      id: workflowId ?? `workflow-${Date.now()}`,
      name: workflowName.trim() || "Untitled Workflow",
      version: "1.0.0",
      nodes: fromReactFlowNodes(nodes),
      edges: exportedEdges,
      globalConfig: workflowGlobalConfig,
      createdAt: timestampIso,
      updatedAt: timestampIso,
    };

    const fileNameBase = workflowJson.name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, "");
    const blob = new Blob([JSON.stringify(workflowJson, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileNameBase || "workflow"}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-12 bg-surface-1 border-b border-edge-dim flex items-center px-4 gap-3 shrink-0">
      <Link
        href="/dashboard"
        className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <ArrowLeft size={14} />
      </Link>

      <div className="flex items-center gap-2.5">
        <Image src="/logo/6flow_white.png" alt="6FLOW" width={28} height={28} />
        <span className="text-[13px] font-bold text-zinc-100 tracking-tight">6FLOW</span>
      </div>

      <div className="w-px h-5 bg-edge-dim mx-1" />

      <Input
        value={workflowName}
        onChange={(e) => setWorkflowName(e.target.value)}
        className="w-56 h-8 bg-surface-2 border-edge-dim text-zinc-200 text-[13px] font-medium hover:border-edge-bright focus:border-accent-blue transition-colors"
      />

      {/* Save status indicator */}
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        {saveStatus === "saving" && (
          <>
            <Loader2 size={12} className="animate-spin" />
            <span>Saving...</span>
          </>
        )}
        {saveStatus === "saved" && (
          <>
            <Cloud size={12} className="text-green-500" />
            <span className="text-green-500">Saved</span>
          </>
        )}
        {saveStatus === "idle" && (
          <>
            <CloudOff size={12} />
            <span>Unsaved</span>
          </>
        )}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2 text-[11px] text-zinc-600">
        {!canRunCompiler && <span>Compiler unavailable</span>}
        {compilerHint && canRunCompiler && <span>{compilerHint}</span>}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="text-zinc-500 hover:text-zinc-300 hover:bg-surface-2 h-8 px-3 text-xs"
          onClick={handleDownloadJson}
        >
          <Download size={13} className="mr-1.5" />
          Export JSON
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="text-zinc-400 hover:text-zinc-200 hover:bg-surface-2 h-8 px-3 text-xs"
          onClick={onOpenSettings}
        >
          <SlidersHorizontal size={13} className="mr-1.5" />
          Workflow Settings
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="text-zinc-400 hover:text-zinc-200 hover:bg-surface-2 h-8 px-3 text-xs"
          disabled={!canRunCompiler || isBusy}
          onClick={onValidate}
        >
          {validationStatus === "running" ? (
            <Loader2 size={13} className="mr-1.5 animate-spin" />
          ) : (
            <CheckCircle size={13} className="mr-1.5" />
          )}
          {validateLabel}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="text-zinc-400 hover:text-zinc-200 hover:bg-surface-2 h-8 px-3 text-xs"
          disabled={!canRunCompiler || isBusy}
          onClick={onCompile}
        >
          {compileStatus === "running" ? (
            <Loader2 size={13} className="mr-1.5 animate-spin" />
          ) : (
            <Play size={13} className="mr-1.5" />
          )}
          {compileLabel}
        </Button>
      </div>
    </div>
  );
}
