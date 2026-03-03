import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { FieldLabel } from "./FieldLabel";
import { useFieldDrop } from "@/hooks/useFieldDrop";
import { VariablePicker } from "./VariablePicker";

interface TextFieldProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
}

export function TextField({
  label,
  description,
  value,
  onChange,
  placeholder,
  mono,
}: TextFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { isDragOver, dropProps } = useFieldDrop({ value, onChange, mode: "insert" });

  function insertAtCursor(expr: string) {
    const el = inputRef.current;
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
      <div className="flex gap-1.5">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`h-8 bg-surface-2 border-edge-dim text-zinc-300 text-[12px] hover:border-edge-bright focus:border-accent-blue transition-colors flex-1 ${mono ? "font-mono" : ""} ${isDragOver ? "border-accent-blue ring-1 ring-accent-blue/30 bg-accent-blue/5" : ""}`}
          {...dropProps}
        />
        <VariablePicker onInsert={insertAtCursor} />
      </div>
    </div>
  );
}
