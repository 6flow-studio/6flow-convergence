"use client";

import { useEffect, useRef, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { useRouter } from "next/navigation";
import { useWorkflowPersistence } from "@/lib/use-workflow-persistence";
import { useCompiler } from "@/lib/use-compiler";
import { useEditorStore } from "@/lib/editor-store";
import { getWorkflowTemplateById } from "@/lib/workflow-templates";
import { fromReactFlowNodes } from "@/lib/workflow-convert";
import { Canvas } from "./Canvas";
import { NodePalette } from "./NodePalette";
import { NodeDetailsModal } from "./NodeDetailsModal";
import { Toolbar } from "./Toolbar";
import { StatusBar } from "./StatusBar";
import { CompilerErrorsPanel } from "./CompilerErrorsPanel";
import { WorkflowSettingsSheet } from "./WorkflowSettingsSheet";
import { CompileProgressModal } from "./CompileProgressModal";
import { NewWorkflowStarterModal } from "./NewWorkflowStarterModal";

interface WorkflowEditorProps {
  workflowId: string;
  showStarterModal?: boolean;
}

export function WorkflowEditor({
  workflowId,
  showStarterModal = false,
}: WorkflowEditorProps) {
  const router = useRouter();
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
  const nodes = useEditorStore((state) => state.nodes);
  const edges = useEditorStore((state) => state.edges);
  const workflowName = useEditorStore((state) => state.workflowName);
  const currentWorkflowId = useEditorStore((state) => state.workflowId);
  const loadWorkflow = useEditorStore((state) => state.loadWorkflow);
  const setWorkflowName = useEditorStore((state) => state.setWorkflowName);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [starterOpen, setStarterOpen] = useState(showStarterModal);
  const hasLoggedTemplateDump = useRef(false);

  useEffect(() => {
    setStarterOpen(showStarterModal);
  }, [showStarterModal]);

  useEffect(() => {
    if (isLoading || currentWorkflowId !== workflowId || hasLoggedTemplateDump.current) {
      return;
    }

    const workflowTemplatePayload = {
      workflowName,
      nodes,
      edges,
      globalConfig: workflowGlobalConfig,
    };

    const persistedPayload = {
      workflowName,
      nodes: fromReactFlowNodes(nodes),
      edges,
      globalConfig: workflowGlobalConfig,
    };

    console.log("6flow-template-json", {
      workflowId,
      workflowTemplatePayload,
      persistedPayload,
    });

    hasLoggedTemplateDump.current = true;
  }, [
    currentWorkflowId,
    edges,
    isLoading,
    nodes,
    workflowGlobalConfig,
    workflowId,
    workflowName,
  ]);

  function closeStarterModal() {
    setStarterOpen(false);
    if (showStarterModal) {
      router.replace(`/editor/${workflowId}`);
    }
  }

  function handleApplyTemplate(templateId: string) {
    const template = getWorkflowTemplateById(templateId);
    if (!template) {
      closeStarterModal();
      return;
    }

    setWorkflowName(template.workflowName);
    loadWorkflow(template.nodes, template.edges);
    setWorkflowGlobalConfig(template.globalConfig);
    closeStarterModal();
  }

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
        <NewWorkflowStarterModal
          open={starterOpen}
          onStartFromScratch={closeStarterModal}
          onApplyTemplate={handleApplyTemplate}
        />
        <NodeDetailsModal />
      </div>
    </ReactFlowProvider>
  );
}
