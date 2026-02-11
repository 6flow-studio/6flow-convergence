"use client";

import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FieldLabel } from "./FieldLabel";

interface KeyValueEditorProps {
  label: string;
  description?: string;
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}

export function KeyValueEditor({
  label,
  description,
  value,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
}: KeyValueEditorProps) {
  const entries = Object.entries(value);

  function updateEntry(oldKey: string, newKey: string, newValue: string) {
    const result: Record<string, string> = {};
    for (const [k, v] of entries) {
      if (k === oldKey) {
        result[newKey] = newValue;
      } else {
        result[k] = v;
      }
    }
    onChange(result);
  }

  function addEntry() {
    const key = `key${entries.length}`;
    onChange({ ...value, [key]: "" });
  }

  function removeEntry(key: string) {
    const { [key]: _, ...rest } = value;
    onChange(rest);
  }

  return (
    <div>
      <FieldLabel label={label} description={description} />
      <div className="space-y-1.5">
        {entries.map(([key, val]) => (
          <div key={key} className="flex gap-1 items-center">
            <Input
              value={key}
              onChange={(e) => updateEntry(key, e.target.value, val)}
              placeholder={keyPlaceholder}
              className="h-7 flex-1 bg-surface-2 border-edge-dim text-zinc-300 text-[11px] font-mono"
            />
            <Input
              value={val}
              onChange={(e) => updateEntry(key, key, e.target.value)}
              placeholder={valuePlaceholder}
              className="h-7 flex-1 bg-surface-2 border-edge-dim text-zinc-300 text-[11px] font-mono"
            />
            <button
              type="button"
              onClick={() => removeEntry(key)}
              className="text-zinc-600 hover:text-zinc-400 transition-colors shrink-0"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addEntry}
          className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <Plus size={11} />
          Add
        </button>
      </div>
    </div>
  );
}
