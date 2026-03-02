"use client";

import { useFieldDrop } from "@/hooks/useFieldDrop";

interface DroppableInputProps {
  value: string;
  onChange: (value: string) => void;
  mode?: "insert" | "replace";
  placeholder?: string;
  className?: string;
}

export function DroppableInput({
  value,
  onChange,
  mode = "insert",
  placeholder,
  className = "",
}: DroppableInputProps) {
  const { isDragOver, dropProps } = useFieldDrop({ value, onChange, mode });

  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${className} ${isDragOver ? "border-accent-blue ring-1 ring-accent-blue/30 bg-accent-blue/5" : ""}`}
      {...dropProps}
    />
  );
}
