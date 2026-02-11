"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { useWorkflowPersistence } from "@/lib/use-workflow-persistence";
import { Canvas } from "./Canvas";
import { NodePalette } from "./NodePalette";
import { ConfigPanel } from "./ConfigPanel";
import { Toolbar } from "./Toolbar";
import { StatusBar } from "./StatusBar";

interface WorkflowEditorProps {
  workflowId: string;
}

export function WorkflowEditor({ workflowId }: WorkflowEditorProps) {
  const { saveStatus, isLoading } = useWorkflowPersistence(workflowId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-0 text-zinc-500 text-sm">
        Loading workflow...
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen bg-surface-0 overflow-hidden">
        <Toolbar saveStatus={saveStatus} />
        <div className="flex flex-1 min-h-0">
          <NodePalette />
          <div className="flex-1 relative">
            <Canvas />
          </div>
          <ConfigPanel />
        </div>
        <StatusBar />
      </div>
    </ReactFlowProvider>
  );
}
