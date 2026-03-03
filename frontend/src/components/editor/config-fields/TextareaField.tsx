import { useEffect, useRef } from "react";
import { FieldLabel } from "./FieldLabel";
import { useFieldDrop } from "@/hooks/useFieldDrop";
import { VariablePicker } from "./VariablePicker";

interface TextareaFieldProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  mono?: boolean;
  autoResize?: boolean;
}

export function TextareaField({
  label,
  description,
  value,
  onChange,
  placeholder,
  rows = 3,
  mono,
  autoResize = false,
}: TextareaFieldProps) {
  const { isDragOver, dropProps } = useFieldDrop({ value, onChange, mode: "insert" });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!autoResize || !textareaRef.current) return;

    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [autoResize, value]);

  function insertAtCursor(expr: string) {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const newValue = value.slice(0, start) + expr + value.slice(end);
    onChange(newValue);
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        el.setSelectionRange(start + expr.length, start + expr.length);
      }
    });
  }

  return (
    <div>
      <FieldLabel label={label} description={description} />
      <div className="flex gap-1.5 items-start">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={`flex-1 rounded-md border border-edge-dim bg-surface-2 px-2.5 py-2 text-[12px] text-zinc-300 hover:border-edge-bright focus:border-accent-blue focus:outline-none transition-colors ${autoResize ? "overflow-hidden resize-y" : "resize-none"} ${mono ? "font-mono" : ""} ${isDragOver ? "border-accent-blue ring-1 ring-accent-blue/30 bg-accent-blue/5" : ""}`}
          {...dropProps}
        />
        <VariablePicker onInsert={insertAtCursor} />
      </div>
    </div>
  );
}
