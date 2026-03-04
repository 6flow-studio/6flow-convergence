"use client";

import { useState } from "react";
import { Sparkles, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WORKFLOW_TEMPLATES } from "@/lib/workflow-templates";

interface NewWorkflowStarterModalProps {
  open: boolean;
  onStartFromScratch: () => void;
  onApplyTemplate: (templateId: string) => void;
}

export function NewWorkflowStarterModal({
  open,
  onStartFromScratch,
  onApplyTemplate,
}: NewWorkflowStarterModalProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    WORKFLOW_TEMPLATES[0]?.id ?? ""
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-[2px] flex items-center justify-center px-4">
      <div className="w-full max-w-6xl min-h-[620px] max-h-[90vh] rounded-xl border border-edge-dim bg-surface-1 shadow-2xl overflow-hidden flex flex-col">
        <div className="px-8 py-6 border-b border-edge-dim">
          <h2 className="text-xl font-semibold text-zinc-100">Create new workflow</h2>
          <p className="text-sm text-zinc-500 mt-2">
            Choose how you want to start building.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8 flex-1 min-h-0">
          <div className="rounded-lg border border-edge-dim bg-surface-2 p-6 flex flex-col">
            <div className="flex items-center gap-2 text-zinc-200">
              <Sparkles size={18} />
              <h3 className="text-base font-semibold">Start from scratch</h3>
            </div>
            <p className="text-sm text-zinc-500 mt-3 leading-relaxed">
              Open a blank canvas and build your workflow node by node.
            </p>
            <div className="mt-4 text-xs text-zinc-500 space-y-1">
              <p>Includes default workflow settings.</p>
              <p>Best when you already know your node structure.</p>
            </div>
            <Button
              className="mt-auto h-10 px-4 text-sm bg-accent-blue hover:bg-blue-500 text-white"
              onClick={onStartFromScratch}
            >
              Start blank workflow
            </Button>
          </div>

          <div className="rounded-lg border border-edge-dim bg-surface-2 p-6 flex flex-col min-h-0">
            <div className="flex items-center gap-2 text-zinc-200">
              <LayoutTemplate size={18} />
              <h3 className="text-base font-semibold">Start from templates</h3>
            </div>
            <p className="text-sm text-zinc-500 mt-3">
              Use a starter workflow and customize it for your use case.
            </p>

            <div className="mt-4 space-y-3 overflow-y-auto pr-1">
              {WORKFLOW_TEMPLATES.map((template) => {
                const selected = template.id === selectedTemplateId;
                return (
                  <button
                    key={template.id}
                    type="button"
                    className={`w-full text-left rounded-md border px-4 py-3 transition-colors ${
                      selected
                        ? "border-accent-blue bg-blue-500/10 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.3)]"
                        : "border-edge-dim hover:border-edge-bright"
                    }`}
                    onClick={() => setSelectedTemplateId(template.id)}
                  >
                    <div className="text-sm font-semibold text-zinc-200">{template.name}</div>
                    <div className="text-xs text-zinc-500 mt-1 leading-relaxed">
                      {template.description}
                    </div>
                  </button>
                );
              })}
            </div>

            <Button
              className="mt-5 h-10 px-4 text-sm bg-accent-blue hover:bg-blue-500 text-white"
              onClick={() => onApplyTemplate(selectedTemplateId)}
              disabled={!selectedTemplateId}
            >
              Use selected template
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
