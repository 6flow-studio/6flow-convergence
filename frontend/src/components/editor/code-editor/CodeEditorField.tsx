"use client";

import { useState, useRef } from "react";
import { Code, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "../config-fields/FieldLabel";
import { CodeEditorSheet } from "./CodeEditorSheet";
import type { CodeExecutionMode } from "@6flow/shared/model/node";

interface CodeEditorFieldProps {
  code: string;
  onCodeChange: (code: string) => void;
  language: string;
  onLanguageChange: (language: string) => void;
  executionMode: CodeExecutionMode;
  onExecutionModeChange: (mode: CodeExecutionMode) => void;
  inputVariables: string[];
  onInputVariablesChange: (vars: string[]) => void;
}

export function CodeEditorField({
  code,
  onCodeChange,
  language,
  onLanguageChange,
  executionMode,
  onExecutionModeChange,
  inputVariables,
  onInputVariablesChange,
}: CodeEditorFieldProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onCodeChange(reader.result);
      }
    };
    reader.readAsText(file);
    // Reset so same file can be re-uploaded
    e.target.value = "";
  }

  const previewLines = code.split("\n").slice(0, 3).join("\n");

  return (
    <div>
      <FieldLabel label="Code" />

      {/* Preview */}
      <div className="rounded-md border border-edge-dim bg-surface-2 px-2.5 py-2 font-mono text-[11px] text-zinc-500 leading-relaxed mb-2 max-h-[52px] overflow-hidden whitespace-pre">
        {previewLines || "// No code yet"}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSheetOpen(true)}
          className="h-7 px-2.5 text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-surface-3 gap-1.5"
        >
          <Code size={12} />
          Edit Code
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="h-7 px-2.5 text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-surface-3 gap-1.5"
        >
          <Upload size={12} />
          Upload .ts
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ts,.tsx,.js,.jsx"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      <CodeEditorSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        code={code}
        onCodeChange={onCodeChange}
        language={language}
        onLanguageChange={onLanguageChange}
        executionMode={executionMode}
        onExecutionModeChange={onExecutionModeChange}
        inputVariables={inputVariables}
        onInputVariablesChange={onInputVariablesChange}
      />
    </div>
  );
}
