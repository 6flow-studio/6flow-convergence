"use client";

import { useEditorStore } from "@/lib/editor-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle, Play, ArrowLeft, Cloud, CloudOff, Loader2 } from "lucide-react";
import Link from "next/link";

interface ToolbarProps {
  saveStatus: "idle" | "saving" | "saved";
}

export function Toolbar({ saveStatus }: ToolbarProps) {
  const workflowName = useEditorStore((s) => s.workflowName);
  const setWorkflowName = useEditorStore((s) => s.setWorkflowName);

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
