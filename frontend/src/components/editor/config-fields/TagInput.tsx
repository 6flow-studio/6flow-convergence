"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { FieldLabel } from "./FieldLabel";

interface TagInputProps {
  label: string;
  description?: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export function TagInput({
  label,
  description,
  value,
  onChange,
  placeholder = "Type and press Enter...",
}: TagInputProps) {
  const [input, setInput] = useState("");

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      if (!value.includes(input.trim())) {
        onChange([...value, input.trim()]);
      }
      setInput("");
    }
    if (e.key === "Backspace" && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  function removeTag(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div>
      <FieldLabel label={label} description={description} />
      <div className="flex flex-wrap gap-1 rounded-md border border-edge-dim bg-surface-2 px-2 py-1.5 min-h-[32px] focus-within:border-accent-blue transition-colors">
        {value.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="inline-flex items-center gap-0.5 rounded bg-surface-3 px-1.5 py-0.5 text-[11px] text-zinc-300 font-medium"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(i)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[60px] bg-transparent text-[12px] text-zinc-300 outline-none placeholder:text-zinc-600"
        />
      </div>
    </div>
  );
}
