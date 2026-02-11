"use client";

import { X, Plus } from "lucide-react";
import { FieldLabel } from "./FieldLabel";
import type { EvmArg } from "@6flow/shared/model/node";

interface EvmArgEditorProps {
  label?: string;
  description?: string;
  value: EvmArg[];
  onChange: (value: EvmArg[]) => void;
}

const ARG_TYPE_OPTIONS = [
  { value: "literal", label: "Literal" },
  { value: "reference", label: "Reference" },
];

const ABI_TYPE_OPTIONS = [
  "address",
  "uint256",
  "bytes32",
  "bool",
  "string",
  "bytes",
];

export function EvmArgEditor({
  label = "Arguments",
  description,
  value,
  onChange,
}: EvmArgEditorProps) {
  function updateArg(index: number, patch: Partial<EvmArg>) {
    const next = [...value];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  function removeArg(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function addArg() {
    onChange([...value, { type: "literal", value: "", abiType: "address" }]);
  }

  return (
    <div>
      <FieldLabel label={label} description={description} />
      <div className="space-y-1.5">
        {value.map((arg, i) => (
          <div key={i} className="flex items-center gap-1">
            <select
              value={arg.type}
              onChange={(e) => updateArg(i, { type: e.target.value as EvmArg["type"] })}
              className="h-7 rounded border border-edge-dim bg-surface-2 px-1.5 text-[11px] text-zinc-300 focus:border-accent-blue focus:outline-none transition-colors"
            >
              {ARG_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              value={arg.value}
              onChange={(e) => updateArg(i, { value: e.target.value })}
              placeholder={arg.type === "reference" ? "{{nodeId.field}}" : "value"}
              className="flex-1 h-7 rounded border border-edge-dim bg-surface-2 px-2 text-[11px] text-zinc-300 font-mono focus:border-accent-blue focus:outline-none transition-colors min-w-0"
            />
            <select
              value={arg.abiType}
              onChange={(e) => updateArg(i, { abiType: e.target.value })}
              className="h-7 rounded border border-edge-dim bg-surface-2 px-1.5 text-[11px] text-zinc-300 focus:border-accent-blue focus:outline-none transition-colors"
            >
              {ABI_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => removeArg(i)}
              className="h-7 w-7 flex items-center justify-center text-zinc-600 hover:text-zinc-300 transition-colors shrink-0"
            >
              <X size={11} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addArg}
          className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors pt-1"
        >
          <Plus size={11} /> Add Argument
        </button>
      </div>
    </div>
  );
}
