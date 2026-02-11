"use client";

import { X, Plus } from "lucide-react";
import { FieldLabel } from "./FieldLabel";
import type { AbiParameter } from "@6flow/shared/model/node";

interface AbiParamsEditorProps {
  label?: string;
  description?: string;
  value: AbiParameter[];
  onChange: (value: AbiParameter[]) => void;
  showIndexed?: boolean;
}

const ABI_TYPES = [
  { value: "address", label: "address" },
  { value: "uint256", label: "uint256" },
  { value: "bytes32", label: "bytes32" },
  { value: "bool", label: "bool" },
  { value: "string", label: "string" },
  { value: "bytes", label: "bytes" },
  { value: "tuple", label: "tuple" },
];

function ParamRow({
  param,
  index,
  onUpdate,
  onRemove,
  showIndexed,
  indent = false,
}: {
  param: AbiParameter;
  index: number;
  onUpdate: (index: number, param: AbiParameter) => void;
  onRemove: (index: number) => void;
  showIndexed: boolean;
  indent?: boolean;
}) {
  return (
    <div className={`flex items-center gap-1 ${indent ? "ml-4" : ""}`}>
      <input
        value={param.name}
        onChange={(e) => onUpdate(index, { ...param, name: e.target.value })}
        placeholder="name"
        className="flex-1 h-7 rounded border border-edge-dim bg-surface-2 px-2 text-[11px] text-zinc-300 font-mono focus:border-accent-blue focus:outline-none transition-colors min-w-0"
      />
      <select
        value={param.type}
        onChange={(e) => onUpdate(index, { ...param, type: e.target.value, components: e.target.value === "tuple" ? param.components ?? [] : undefined })}
        className="h-7 rounded border border-edge-dim bg-surface-2 px-1.5 text-[11px] text-zinc-300 focus:border-accent-blue focus:outline-none transition-colors"
      >
        {ABI_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      {showIndexed && (
        <button
          type="button"
          onClick={() => onUpdate(index, { ...param, indexed: !param.indexed })}
          className={`h-7 px-1.5 rounded text-[10px] font-medium transition-colors ${
            param.indexed
              ? "bg-accent-blue/10 text-accent-blue"
              : "bg-surface-3 text-zinc-600 hover:text-zinc-400"
          }`}
          title="Indexed"
        >
          idx
        </button>
      )}
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="h-7 w-7 flex items-center justify-center text-zinc-600 hover:text-zinc-300 transition-colors shrink-0"
      >
        <X size={11} />
      </button>
    </div>
  );
}

export function AbiParamsEditor({
  label = "ABI Parameters",
  description,
  value,
  onChange,
  showIndexed = false,
}: AbiParamsEditorProps) {
  function updateParam(index: number, param: AbiParameter) {
    const next = [...value];
    next[index] = param;
    onChange(next);
  }

  function removeParam(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function addParam() {
    onChange([...value, { name: "", type: "address" }]);
  }

  function updateComponent(paramIndex: number, compIndex: number, comp: AbiParameter) {
    const next = [...value];
    const components = [...(next[paramIndex].components ?? [])];
    components[compIndex] = comp;
    next[paramIndex] = { ...next[paramIndex], components };
    onChange(next);
  }

  function removeComponent(paramIndex: number, compIndex: number) {
    const next = [...value];
    const components = (next[paramIndex].components ?? []).filter((_, i) => i !== compIndex);
    next[paramIndex] = { ...next[paramIndex], components };
    onChange(next);
  }

  function addComponent(paramIndex: number) {
    const next = [...value];
    const components = [...(next[paramIndex].components ?? []), { name: "", type: "address" }];
    next[paramIndex] = { ...next[paramIndex], components };
    onChange(next);
  }

  return (
    <div>
      <FieldLabel label={label} description={description} />
      <div className="space-y-1.5">
        {value.map((param, i) => (
          <div key={i}>
            <ParamRow
              param={param}
              index={i}
              onUpdate={updateParam}
              onRemove={removeParam}
              showIndexed={showIndexed}
            />
            {param.type === "tuple" && (
              <div className="mt-1 space-y-1">
                {(param.components ?? []).map((comp, ci) => (
                  <ParamRow
                    key={ci}
                    param={comp}
                    index={ci}
                    onUpdate={(ci2, c) => updateComponent(i, ci2, c)}
                    onRemove={(ci2) => removeComponent(i, ci2)}
                    showIndexed={false}
                    indent
                  />
                ))}
                <button
                  type="button"
                  onClick={() => addComponent(i)}
                  className="ml-4 flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <Plus size={10} /> Component
                </button>
              </div>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addParam}
          className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors pt-1"
        >
          <Plus size={11} /> Add Parameter
        </button>
      </div>
    </div>
  );
}
