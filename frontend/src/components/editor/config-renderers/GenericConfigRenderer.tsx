"use client";

import { Input } from "@/components/ui/input";
import {
  TextField,
  TextareaField,
  NumberField,
  BooleanField,
  TagInput,
} from "../config-fields";

interface Props {
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function isLongString(value: string): boolean {
  return value.length > 60 || value.includes("\n");
}

export function GenericConfigRenderer({ config, onChange }: Props) {
  return (
    <div className="space-y-2.5">
      {Object.entries(config).map(([key, value]) => {
        const label = formatLabel(key);

        if (typeof value === "string") {
          if (isLongString(value)) {
            return (
              <TextareaField
                key={key}
                label={label}
                value={value}
                onChange={(v) => onChange({ [key]: v })}
                rows={3}
                mono
              />
            );
          }
          return (
            <TextField
              key={key}
              label={label}
              value={value}
              onChange={(v) => onChange({ [key]: v })}
              mono
            />
          );
        }

        if (typeof value === "number") {
          return (
            <NumberField
              key={key}
              label={label}
              value={value}
              onChange={(v) => onChange({ [key]: v })}
            />
          );
        }

        if (typeof value === "boolean") {
          return (
            <BooleanField
              key={key}
              label={label}
              value={value}
              onChange={(v) => onChange({ [key]: v })}
            />
          );
        }

        if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
          return (
            <TagInput
              key={key}
              label={label}
              value={value as string[]}
              onChange={(v) => onChange({ [key]: v })}
            />
          );
        }

        // Fallback: read-only JSON
        return (
          <div key={key}>
            <label className="text-[11px] text-zinc-500 mb-1 block font-medium">
              {label}
            </label>
            <div className="text-[11px] text-zinc-600 bg-surface-2 border border-edge-dim rounded-md px-2.5 py-2 font-mono leading-relaxed break-all">
              {JSON.stringify(value, null, 2).slice(0, 200)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
