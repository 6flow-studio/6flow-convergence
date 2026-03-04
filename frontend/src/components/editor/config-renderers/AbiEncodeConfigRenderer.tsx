"use client";

import { useEffect } from "react";
import { X, Plus } from "lucide-react";
import { ABI_TYPES } from "../config-fields/AbiParamsEditor";
import { DroppableInput } from "../config-fields/DroppableInput";
import { FieldLabel } from "../config-fields/FieldLabel";
import type {
  AbiEncodeConfig,
  AbiParameter,
  DataSchema,
} from "@6flow/shared/model/node";
import { useEditorStore } from "@/lib/editor-store";

interface UnifiedParam {
  name: string;
  type: string;
  source: string;
  components?: AbiParameter[];
}

interface Props {
  config: AbiEncodeConfig;
  onChange: (patch: Record<string, unknown>) => void;
  nodeId?: string;
}

const ABI_ENCODE_OUTPUT_SCHEMA: DataSchema = {
  type: "object",
  path: "",
  fields: [
    {
      key: "encoded",
      path: "encoded",
      schema: {
        type: "string",
        path: "encoded",
      },
    },
  ],
};

/** Zip abiParams + dataMapping into unified rows */
function deriveRows(config: AbiEncodeConfig): UnifiedParam[] {
  const params = config.abiParams ?? [];
  const mapping = config.dataMapping ?? [];

  return params.map((p, i) => {
    // Match by paramName first, fall back to positional index
    const matched = mapping.find((m) => m.paramName === p.name) ?? mapping[i];
    return {
      name: p.name,
      type: p.type,
      source: matched?.source ?? "",
      components: p.components,
    };
  });
}

/** Emit both arrays from unified rows */
function emitArrays(rows: UnifiedParam[]) {
  const abiParams: AbiParameter[] = rows.map((r) => ({
    name: r.name,
    type: r.type,
    ...(r.components ? { components: r.components } : {}),
  }));
  const dataMapping = rows.map((r) => ({
    paramName: r.name,
    source: r.source,
  }));
  return { abiParams, dataMapping };
}

const inputClass =
  "h-7 rounded border border-edge-dim bg-surface-2 px-2 text-[11px] text-zinc-300 font-mono focus:border-accent-blue focus:outline-none transition-colors min-w-0";

export function AbiEncodeConfigRenderer({ config, onChange, nodeId }: Props) {
  const rows = deriveRows(config);
  const updateNodeEditor = useEditorStore((state) => state.updateNodeEditor);

  useEffect(() => {
    if (!nodeId) return;
    updateNodeEditor(nodeId, {
      outputSchema: ABI_ENCODE_OUTPUT_SCHEMA,
      schemaSource: "derived",
    });
  }, [nodeId, updateNodeEditor]);

  function commit(next: UnifiedParam[]) {
    onChange(emitArrays(next));
  }

  function updateRow(index: number, patch: Partial<UnifiedParam>) {
    const next = [...rows];
    next[index] = { ...next[index], ...patch };
    // If type changed away from tuple, drop components
    if (patch.type && patch.type !== "tuple") {
      delete next[index].components;
    }
    // If type changed to tuple, ensure components array exists
    if (patch.type === "tuple" && !next[index].components) {
      next[index].components = [];
    }
    commit(next);
  }

  function removeRow(index: number) {
    commit(rows.filter((_, i) => i !== index));
  }

  function addRow() {
    commit([...rows, { name: "", type: "address", source: "" }]);
  }

  function updateComponent(
    rowIndex: number,
    compIndex: number,
    comp: AbiParameter,
  ) {
    const next = [...rows];
    const components = [...(next[rowIndex].components ?? [])];
    components[compIndex] = comp;
    next[rowIndex] = { ...next[rowIndex], components };
    commit(next);
  }

  function removeComponent(rowIndex: number, compIndex: number) {
    const next = [...rows];
    const components = (next[rowIndex].components ?? []).filter(
      (_, i) => i !== compIndex,
    );
    next[rowIndex] = { ...next[rowIndex], components };
    commit(next);
  }

  function addComponent(rowIndex: number) {
    const next = [...rows];
    const components = [
      ...(next[rowIndex].components ?? []),
      { name: "", type: "address" },
    ];
    next[rowIndex] = { ...next[rowIndex], components };
    commit(next);
  }

  return (
    <div>
      <FieldLabel
        label="ABI Parameters"
        description="Define parameters and map data sources"
      />
      <div className="space-y-1.5">
        {rows.map((row, i) => (
          <div key={i}>
            {/* Main row: name + type + source + remove */}
            <div className="flex items-center gap-1">
              <input
                value={row.name ?? ""}
                onChange={(e) => updateRow(i, { name: e.target.value })}
                placeholder="name"
                className={`flex-1 ${inputClass}`}
              />
              <select
                value={row.type}
                onChange={(e) => updateRow(i, { type: e.target.value })}
                className="h-7 rounded border border-edge-dim bg-surface-2 px-1.5 text-[11px] text-zinc-300 focus:border-accent-blue focus:outline-none transition-colors"
              >
                {ABI_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <DroppableInput
                value={row.source}
                onChange={(source) => updateRow(i, { source })}
                mode="replace"
                placeholder="{{node.field}}"
                className={`flex-[2] ${inputClass}`}
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="h-7 w-7 flex items-center justify-center text-zinc-600 hover:text-zinc-300 transition-colors shrink-0"
              >
                <X size={11} />
              </button>
            </div>

            {/* Tuple components (indented, name + type only) */}
            {row.type === "tuple" && (
              <div className="mt-1 ml-4 space-y-1">
                {(row.components ?? []).map((comp, ci) => (
                  <div key={ci} className="flex items-center gap-1">
                    <input
                      value={comp.name ?? ""}
                      onChange={(e) =>
                        updateComponent(i, ci, {
                          ...comp,
                          name: e.target.value,
                        })
                      }
                      placeholder="name"
                      className={`flex-1 ${inputClass}`}
                    />
                    <select
                      value={comp.type}
                      onChange={(e) =>
                        updateComponent(i, ci, {
                          ...comp,
                          type: e.target.value,
                          components:
                            e.target.value === "tuple"
                              ? (comp.components ?? [])
                              : undefined,
                        })
                      }
                      className="h-7 rounded border border-edge-dim bg-surface-2 px-1.5 text-[11px] text-zinc-300 focus:border-accent-blue focus:outline-none transition-colors"
                    >
                      {ABI_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeComponent(i, ci)}
                      className="h-7 w-7 flex items-center justify-center text-zinc-600 hover:text-zinc-300 transition-colors shrink-0"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addComponent(i)}
                  className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <Plus size={10} /> Component
                </button>
              </div>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors pt-1"
        >
          <Plus size={11} /> Add Parameter
        </button>
      </div>
    </div>
  );
}
