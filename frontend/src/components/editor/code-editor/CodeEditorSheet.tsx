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
import { SelectField } from "../config-fields";
import { editorTheme, editorHighlighting } from "./codemirror-theme";
import { buildVariableCompletions } from "./variable-completions";
import { useScopedVariables } from "@/hooks/useScopedVariables";
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
  returnLine?: string;
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
  returnLine,
}: CodeEditorSheetProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const onCodeChangeRef = useRef(onCodeChange);
  onCodeChangeRef.current = onCodeChange;

  // Keep a ref to the current code so initEditor always initializes with the latest value
  const codeRef = useRef(code);
  codeRef.current = code;

  const scopedVariables = useScopedVariables();
  const scopedVarsRef = useRef(scopedVariables);
  scopedVarsRef.current = scopedVariables;

  const initEditor = useCallback(() => {
    if (!editorContainerRef.current) return;

    // Destroy previous instance
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    const completionSource = buildVariableCompletions(() =>
      scopedVarsRef.current.map((v) => ({ label: v.codeInsert, detail: v.type })),
    );

    const blockReturnKeyword = EditorState.transactionFilter.of((tr) => {
      if (!tr.docChanged) return tr;
      const newDoc = tr.newDoc.toString();
      const hasReturn = newDoc.split("\n").some((line) => /^\s*return\b/.test(line));
      return hasReturn ? [] : tr;
    });

    const state = EditorState.create({
      doc: codeRef.current,
      extensions: [
        lineNumbers(),
        history(),
        foldGutter(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion({ override: [completionSource] }),
        javascript({ typescript: true }),
        editorTheme,
        editorHighlighting,
        blockReturnKeyword,
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

  function insertAtCursor(text: string) {
    const view = viewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    });
    view.focus();
  }

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

        {/* Variables in scope chip bar */}
        {scopedVariables.length > 0 && (
          <div className="px-4 py-2 border-b border-edge-dim flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-zinc-600 shrink-0">In scope:</span>
            {scopedVariables.map((v) => (
              <button
                key={v.expression}
                type="button"
                onClick={() => insertAtCursor(v.codeInsert)}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-edge-dim bg-surface-2 hover:bg-surface-3 hover:border-edge-bright transition-colors cursor-pointer"
                title={`Insert ${v.codeInsert}`}
              >
                <span className="font-mono text-[11px] text-zinc-300">{v.name}</span>
                <span className="text-[10px] text-zinc-600">{v.type}</span>
              </button>
            ))}
          </div>
        )}

        {/* Editor + auto-generated return line */}
        <div className="flex flex-col flex-1 min-h-0">
          <div ref={editorContainerRef} className="flex-1 overflow-auto" />
          {returnLine && (
            <div className="shrink-0 border-t border-edge-dim px-3 py-1.5 font-mono text-[12px] text-zinc-500 bg-surface-1 flex items-center justify-between">
              <span>{returnLine}</span>
              <span className="text-[10px] text-zinc-700 ml-3">auto</span>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
