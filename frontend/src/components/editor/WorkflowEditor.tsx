"use client";

import { useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { useWorkflowPersistence } from "@/lib/use-workflow-persistence";
import { useCompiler } from "@/lib/use-compiler";
import { useEditorStore } from "@/lib/editor-store";
import { Canvas } from "./Canvas";
import { NodePalette } from "./NodePalette";
import { ConfigPanel } from "./ConfigPanel";
import { Toolbar } from "./Toolbar";
import { StatusBar } from "./StatusBar";
import { CompilerErrorsPanel } from "./CompilerErrorsPanel";
import { WorkflowSettingsSheet } from "./WorkflowSettingsSheet";
import { CompileProgressModal } from "./CompileProgressModal";

interface WorkflowEditorProps {
  workflowId: string;
}

export function WorkflowEditor({ workflowId }: WorkflowEditorProps) {
  const { saveStatus, isLoading } = useWorkflowPersistence(workflowId);
  const {
    canRunCompiler,
    compilerReady,
    compilerError,
    validationStatus,
    compileStatus,
    validationMessage,
    compileMessage,
    compileModalOpen,
    compiledZipDownload,
    onValidate,
    onCompile,
    onCloseCompileModal,
  } = useCompiler();
  const workflowGlobalConfig = useEditorStore((state) => state.workflowGlobalConfig);
  const setWorkflowGlobalConfig = useEditorStore(
    (state) => state.setWorkflowGlobalConfig
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

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
        <Toolbar
          saveStatus={saveStatus}
          canRunCompiler={canRunCompiler}
          validationStatus={validationStatus}
          compileStatus={compileStatus}
          validationMessage={validationMessage}
          compileMessage={compileMessage}
          onValidate={() => {
            void onValidate();
          }}
          onCompile={() => {
            void onCompile();
          }}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <div className="flex flex-1 min-h-0">
          <NodePalette />
          <div className="flex-1 relative">
            <Canvas />
          </div>
          <ConfigPanel />
        </div>
        <CompilerErrorsPanel />
        <StatusBar
          saveStatus={saveStatus}
          compilerReady={compilerReady}
          compilerError={compilerError}
          validationStatus={validationStatus}
          compileStatus={compileStatus}
        />
        <WorkflowSettingsSheet
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          value={workflowGlobalConfig}
          onSave={setWorkflowGlobalConfig}
        />
        <CompileProgressModal
          open={compileModalOpen}
          status={compileStatus}
          message={compileMessage}
          downloadUrl={compiledZipDownload?.url ?? null}
          downloadFileName={compiledZipDownload?.fileName ?? null}
          onClose={onCloseCompileModal}
        />
      </div>
    </ReactFlowProvider>
  );
}
