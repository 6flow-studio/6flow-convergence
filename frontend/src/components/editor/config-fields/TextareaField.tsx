import { useEffect, useRef } from "react";
import { FieldLabel } from "./FieldLabel";
import { useFieldDrop } from "@/hooks/useFieldDrop";

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
  const { isDragOver, dropProps } = useFieldDrop({
    value,
    onChange,
    mode: "insert",
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!autoResize || !textareaRef.current) return;

    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [autoResize, value]);

  return (
    <div>
      <FieldLabel label={label} description={description} />
      <textarea
        ref={textareaRef}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`w-full rounded-md border border-edge-dim bg-surface-2 px-2.5 py-2 text-[12px] text-zinc-300 hover:border-edge-bright focus:border-accent-blue focus:outline-none transition-colors ${autoResize ? "overflow-hidden resize-y" : "resize-none"} ${mono ? "font-mono" : ""} ${isDragOver ? "border-accent-blue ring-1 ring-accent-blue/30 bg-accent-blue/5" : ""}`}
        {...dropProps}
      />
    </div>
  );
}
