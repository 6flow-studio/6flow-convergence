"use client";

import { useEffect } from "react";
import { Plus, X } from "lucide-react";
import { SelectField, NumberField } from "../config-fields";
import { CodeEditorField } from "../code-editor/CodeEditorField";
import { useEditorStore } from "@/lib/editor-store";
import type {
  CodeNodeConfig,
  CodeExecutionMode,
  DataSchema,
  DataSchemaType,
} from "@6flow/shared/model/node";

const SCHEMA_TYPE_OPTIONS: { value: DataSchemaType; label: string }[] = [
  { value: "string", label: "string" },
  { value: "number", label: "number" },
  { value: "boolean", label: "boolean" },
  { value: "object", label: "object" },
  { value: "array", label: "array" },
  { value: "unknown", label: "unknown" },
];

function buildOutputSchema(
  fields: { key: string; type: DataSchemaType }[],
): DataSchema {
  return {
    type: "object",
    path: "",
    fields: fields
      .filter((f) => f.key.trim())
      .map((f) => ({
        key: f.key,
        path: f.key,
        schema: { type: f.type, path: f.key },
      })),
  };
}

function generateReturnLine(fields: { key: string; type: DataSchemaType }[]): string {
  const keys = fields.map((f) => f.key).filter(Boolean);
  if (keys.length === 0) return "";
  return `return { ${keys.join(", ")} };`;
}

function stripTrailingReturn(code: string): string {
  const lines = code.split("\n");
  const lastNonEmpty = lines.findLastIndex((l) => l.trim() !== "");
  if (lastNonEmpty >= 0 && lines[lastNonEmpty].trimStart().startsWith("return ")) {
    lines.splice(lastNonEmpty, 1);
    return lines.join("\n").trimEnd();
  }
  return code;
}

interface Props {
  config: CodeNodeConfig;
  onChange: (patch: Record<string, unknown>) => void;
  nodeId?: string;
}

export function CodeNodeConfigRenderer({ config, onChange, nodeId }: Props) {
  const updateNodeEditor = useEditorStore((s) => s.updateNodeEditor);

  const outputFields = config.outputFields ?? [];
  const returnLine = generateReturnLine(outputFields);

  // Sync declared outputFields → outputSchema
  useEffect(() => {
    if (!nodeId) return;
    updateNodeEditor(nodeId, {
      outputSchema: buildOutputSchema(config.outputFields ?? []),
      schemaSource: "declared",
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, config.outputFields, updateNodeEditor]);

  function handleOutputFieldsChange(newFields: { key: string; type: DataSchemaType }[]) {
    const wasEmpty = outputFields.length === 0;
    const willHaveFields = newFields.length > 0;
    let code = config.code ?? "";
    if (wasEmpty && willHaveFields) {
      code = stripTrailingReturn(code);
    }
    onChange({ outputFields: newFields, code });
  }

  function addField() {
    handleOutputFieldsChange([...outputFields, { key: "", type: "string" as DataSchemaType }]);
  }

  function updateField(index: number, patch: Partial<{ key: string; type: DataSchemaType }>) {
    const next = outputFields.map((f, i) => (i === index ? { ...f, ...patch } : f));
    onChange({ outputFields: next });
  }

  function removeField(index: number) {
    onChange({ outputFields: outputFields.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-3">
      <SelectField
        label="Language"
        value={config.language ?? "typescript"}
        onChange={(v) => onChange({ language: v })}
        options={[{ value: "typescript", label: "TypeScript" }]}
      />

      <SelectField
        label="Execution Mode"
        value={config.executionMode}
        onChange={(v) => onChange({ executionMode: v })}
        options={[
          { value: "runOnceForAll", label: "Run Once For All" },
          { value: "runOnceForEach", label: "Run Once For Each" },
        ]}
      />

      <CodeEditorField
        code={config.code}
        onCodeChange={(code) => onChange({ code })}
        language={config.language ?? "typescript"}
        onLanguageChange={(language) => onChange({ language })}
        executionMode={config.executionMode}
        onExecutionModeChange={(executionMode: CodeExecutionMode) =>
          onChange({ executionMode })
        }
        returnLine={returnLine}
      />

      {/* Output Fields */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.08em]">
            Output Fields
            <span className="ml-1 text-zinc-700 normal-case font-normal">(optional)</span>
          </label>
        </div>

        {outputFields.length > 0 && (
          <div className="space-y-1">
            {outputFields.map((field, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={field.key}
                  onChange={(e) => updateField(i, { key: e.target.value })}
                  placeholder="key"
                  className="flex-1 h-7 px-2 rounded bg-surface-2 border border-edge-dim text-zinc-200 text-[12px] placeholder:text-zinc-600 focus:outline-none focus:border-accent-blue"
                />
                <select
                  value={field.type}
                  onChange={(e) => updateField(i, { type: e.target.value as DataSchemaType })}
                  className="h-7 px-1.5 rounded bg-surface-2 border border-edge-dim text-zinc-200 text-[12px] focus:outline-none focus:border-accent-blue"
                >
                  {SCHEMA_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeField(i)}
                  className="h-7 w-7 flex items-center justify-center rounded text-zinc-500 hover:text-red-400 hover:bg-surface-3 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addField}
          className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <Plus size={12} />
          Add Field
        </button>
      </div>

      <NumberField
        label="Timeout (ms)"
        description="Max execution time"
        value={config.timeout}
        onChange={(timeout) => onChange({ timeout })}
        min={0}
        max={30000}
        step={100}
      />
    </div>
  );
}
