"use client";

import { useEffect, useRef, useCallback } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { searchKeymap } from "@codemirror/search";
import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
} from "@codemirror/autocomplete";
import { bracketMatching, foldGutter, indentOnInput } from "@codemirror/language";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SelectField, TagInput } from "../config-fields";
import { editorTheme, editorHighlighting } from "./codemirror-theme";
import type { CodeExecutionMode } from "@6flow/shared/model/node";

interface CodeEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
  onCodeChange: (code: string) => void;
  language: string;
  onLanguageChange: (language: string) => void;
  executionMode: CodeExecutionMode;
  onExecutionModeChange: (mode: CodeExecutionMode) => void;
  inputVariables: string[];
  onInputVariablesChange: (vars: string[]) => void;
}

export function CodeEditorSheet({
  open,
  onOpenChange,
  code,
  onCodeChange,
  language,
  onLanguageChange,
  executionMode,
  onExecutionModeChange,
  inputVariables,
  onInputVariablesChange,
}: CodeEditorSheetProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const onCodeChangeRef = useRef(onCodeChange);
  onCodeChangeRef.current = onCodeChange;

  const initEditor = useCallback(() => {
    if (!editorContainerRef.current) return;

    // Destroy previous instance
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    const state = EditorState.create({
      doc: code,
      extensions: [
        lineNumbers(),
        history(),
        foldGutter(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        javascript({ typescript: true }),
        editorTheme,
        editorHighlighting,
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          ...completionKeymap,
          ...closeBracketsKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onCodeChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });

    viewRef.current = new EditorView({
      state,
      parent: editorContainerRef.current,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (open) {
      // Delay to wait for sheet animation
      const timer = setTimeout(initEditor, 100);
      return () => clearTimeout(timer);
    } else if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }
  }, [open, initEditor]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[70vw] sm:max-w-none bg-surface-1 border-edge-dim p-0 flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b border-edge-dim flex-row items-center justify-between space-y-0">
          <div>
            <SheetTitle className="text-[13px] text-zinc-200">
              Code Editor
            </SheetTitle>
            <SheetDescription className="text-[11px] text-zinc-600">
              Write TypeScript code for this node
            </SheetDescription>
          </div>
          <Button
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-7 px-3 text-[11px] bg-accent-blue hover:bg-accent-blue/80 text-white"
          >
            Done
          </Button>
        </SheetHeader>

        {/* Controls */}
        <div className="px-4 py-2.5 border-b border-edge-dim flex gap-3">
          <div className="w-[160px]">
            <SelectField
              label="Language"
              value={language}
              onChange={onLanguageChange}
              options={[{ value: "typescript", label: "TypeScript" }]}
            />
          </div>
          <div className="w-[180px]">
            <SelectField
              label="Mode"
              value={executionMode}
              onChange={(v) => onExecutionModeChange(v as CodeExecutionMode)}
              options={[
                { value: "runOnceForAll", label: "Run Once For All" },
                { value: "runOnceForEach", label: "Run Once For Each" },
              ]}
            />
          </div>
        </div>

        {/* Editor */}
        <div ref={editorContainerRef} className="flex-1 overflow-auto" />

        {/* Footer: Input Variables */}
        <div className="px-4 py-2.5 border-t border-edge-dim">
          <TagInput
            label="Input Variables"
            value={inputVariables}
            onChange={onInputVariablesChange}
            placeholder="Type variable name and press Enter..."
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
