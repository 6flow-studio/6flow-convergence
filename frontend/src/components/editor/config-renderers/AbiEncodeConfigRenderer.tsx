"use client";

import { X, Plus } from "lucide-react";
import { AbiParamsEditor } from "../config-fields/AbiParamsEditor";
import { FieldLabel } from "../config-fields/FieldLabel";
import type { AbiEncodeConfig } from "@6flow/shared/model/node";

interface Props {
  config: AbiEncodeConfig;
  onChange: (patch: Record<string, unknown>) => void;
}

export function AbiEncodeConfigRenderer({ config, onChange }: Props) {
  const dataMapping = config.dataMapping ?? [];

  function updateMapping(index: number, patch: Partial<{ paramName: string; source: string }>) {
    const next = [...dataMapping];
    next[index] = { ...next[index], ...patch };
    onChange({ dataMapping: next });
  }

  function removeMapping(index: number) {
    onChange({ dataMapping: dataMapping.filter((_, i) => i !== index) });
  }

  function addMapping() {
    onChange({ dataMapping: [...dataMapping, { paramName: "", source: "" }] });
  }

  return (
    <div className="space-y-3">
      <AbiParamsEditor
        label="ABI Parameters"
        value={config.abiParams}
        onChange={(abiParams) => onChange({ abiParams })}
      />

      <div>
        <FieldLabel label="Data Mapping" description="Map parameters to sources" />
        <div className="space-y-1.5">
          {dataMapping.map((mapping, i) => (
            <div key={i} className="flex items-center gap-1">
              <input
                value={mapping.paramName}
                onChange={(e) => updateMapping(i, { paramName: e.target.value })}
                placeholder="paramName"
                className="flex-1 h-7 rounded border border-edge-dim bg-surface-2 px-2 text-[11px] text-zinc-300 font-mono focus:border-accent-blue focus:outline-none transition-colors min-w-0"
              />
              <span className="text-[10px] text-zinc-600 shrink-0">&rarr;</span>
              <input
                value={mapping.source}
                onChange={(e) => updateMapping(i, { source: e.target.value })}
                placeholder="{{node.field}}"
                className="flex-1 h-7 rounded border border-edge-dim bg-surface-2 px-2 text-[11px] text-zinc-300 font-mono focus:border-accent-blue focus:outline-none transition-colors min-w-0"
              />
              <button
                type="button"
                onClick={() => removeMapping(i)}
                className="h-7 w-7 flex items-center justify-center text-zinc-600 hover:text-zinc-300 transition-colors shrink-0"
              >
                <X size={11} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addMapping}
            className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors pt-1"
          >
            <Plus size={11} /> Add Mapping
          </button>
        </div>
      </div>
    </div>
  );
}
