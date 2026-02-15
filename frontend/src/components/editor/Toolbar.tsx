"use client";

import { useEditorStore } from "@/lib/editor-store";
import { fromReactFlowNodes } from "@/lib/workflow-convert";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Play,
  ArrowLeft,
  Cloud,
  CloudOff,
  Loader2,
  Download,
  Settings2,
} from "lucide-react";
import Link from "next/link";
import type {
  Workflow as SharedWorkflow,
  WorkflowEdge as SharedWorkflowEdge,
} from "@6flow/shared/model/node";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface ToolbarProps {
  saveStatus: "idle" | "saving" | "saved";
}

export function Toolbar({ saveStatus }: ToolbarProps) {
  const workflowName = useEditorStore((s) => s.workflowName);
  const workflowId = useEditorStore((s) => s.workflowId);
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const globalConfig = useEditorStore((s) => s.globalConfig);
  const setGlobalConfig = useEditorStore((s) => s.setGlobalConfig);
  const setWorkflowName = useEditorStore((s) => s.setWorkflowName);

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
      globalConfig,
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
        <div className="w-7 h-7 rounded-md bg-accent-blue/10 flex items-center justify-center">
          <span className="text-accent-blue text-sm font-bold">六</span>
        </div>
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

      <div className="flex items-center gap-1">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-500 hover:text-zinc-300 hover:bg-surface-2 h-8 px-3 text-xs"
            >
              <Settings2 size={13} className="mr-1.5" />
              Settings
            </Button>
          </SheetTrigger>
          <SheetContent
            className="bg-surface-1 border-l border-edge-dim text-zinc-200 sm:max-w-md"
            showCloseButton
          >
            <SheetHeader className="border-b border-edge-dim px-4 py-3.5">
              <SheetTitle className="text-sm text-zinc-100">Workflow Settings</SheetTitle>
              <SheetDescription className="text-xs text-zinc-500">
                Configure workflow-level secrets and runtime values.
              </SheetDescription>
            </SheetHeader>

            <div className="px-4 py-4 space-y-2.5">
              <label
                htmlFor="workflow-private-key"
                className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.08em] block"
              >
                Private Key
              </label>
              <Input
                id="workflow-private-key"
                type="password"
                placeholder="0x..."
                value={globalConfig.privateKey ?? ""}
                onChange={(e) => setGlobalConfig({ privateKey: e.target.value })}
                className="h-9 bg-surface-2 border-edge-dim text-zinc-200 text-[12px] hover:border-edge-bright focus:border-accent-blue transition-colors"
              />
              <p className="text-[11px] leading-relaxed text-zinc-500">
                Stored in this workflow and included in exported JSON.
              </p>
            </div>
          </SheetContent>
        </Sheet>

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
          className="text-zinc-500 hover:text-zinc-300 hover:bg-surface-2 h-8 px-3 text-xs"
          disabled
        >
          <CheckCircle size={13} className="mr-1.5" />
          Validate
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="text-zinc-500 hover:text-zinc-300 hover:bg-surface-2 h-8 px-3 text-xs"
          disabled
        >
          <Play size={13} className="mr-1.5" />
          Compile
        </Button>
      </div>
    </div>
  );
}
