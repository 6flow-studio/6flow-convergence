"use client";

import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Condition, ComparisonOperator } from "@6flow/shared/model/node";

const OPERATORS: { value: ComparisonOperator; label: string }[] = [
  { value: "equals", label: "Equals" },
  { value: "notEquals", label: "Not Equals" },
  { value: "gt", label: "Greater Than" },
  { value: "gte", label: "Greater or Equal" },
  { value: "lt", label: "Less Than" },
  { value: "lte", label: "Less or Equal" },
  { value: "contains", label: "Contains" },
  { value: "notContains", label: "Not Contains" },
  { value: "startsWith", label: "Starts With" },
  { value: "endsWith", label: "Ends With" },
  { value: "regex", label: "Regex" },
  { value: "notRegex", label: "Not Regex" },
  { value: "exists", label: "Exists" },
  { value: "notExists", label: "Not Exists" },
  { value: "isEmpty", label: "Is Empty" },
  { value: "isNotEmpty", label: "Is Not Empty" },
];

const NO_VALUE_OPERATORS: ComparisonOperator[] = [
  "exists",
  "notExists",
  "isEmpty",
  "isNotEmpty",
];

interface ConditionBuilderProps {
  conditions: Condition[];
  combineWith: "and" | "or";
  onChange: (conditions: Condition[], combineWith: "and" | "or") => void;
  label?: string;
}

export function ConditionBuilder({
  conditions,
  combineWith,
  onChange,
  label,
}: ConditionBuilderProps) {
  function updateCondition(index: number, patch: Partial<Condition>) {
    const updated = conditions.map((c, i) =>
      i === index ? { ...c, ...patch } : c
    );
    onChange(updated, combineWith);
  }

  function removeCondition(index: number) {
    if (conditions.length <= 1) return;
    onChange(
      conditions.filter((_, i) => i !== index),
      combineWith
    );
  }

  function addCondition() {
    onChange(
      [...conditions, { field: "", operator: "equals" as ComparisonOperator, value: "" }],
      combineWith
    );
  }

  return (
    <div className="space-y-2">
      {label && (
        <span className="text-[11px] text-zinc-500 font-medium block">
          {label}
        </span>
      )}

      {/* AND/OR toggle */}
      <div className="flex gap-1">
        {(["and", "or"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(conditions, mode)}
            className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider transition-colors ${
              combineWith === mode
                ? "bg-accent-blue/15 text-accent-blue"
                : "bg-surface-3 text-zinc-600 hover:text-zinc-400"
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* Condition rows */}
      <div className="space-y-1.5">
        {conditions.map((condition, i) => (
          <div key={i} className="flex gap-1 items-start">
            <Input
              value={condition.field}
              onChange={(e) => updateCondition(i, { field: e.target.value })}
              placeholder="Field"
              className="h-7 flex-1 bg-surface-2 border-edge-dim text-zinc-300 text-[11px] font-mono"
            />
            <Select
              value={condition.operator}
              onValueChange={(val) =>
                updateCondition(i, { operator: val as ComparisonOperator })
              }
            >
              <SelectTrigger
                size="sm"
                className="h-7 w-[100px] bg-surface-2 border-edge-dim text-zinc-300 text-[10px] shrink-0"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-surface-2 border-edge-dim max-h-[200px]">
                {OPERATORS.map((op) => (
                  <SelectItem
                    key={op.value}
                    value={op.value}
                    className="text-[11px] text-zinc-300 focus:bg-surface-3"
                  >
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!NO_VALUE_OPERATORS.includes(condition.operator) && (
              <Input
                value={condition.value ?? ""}
                onChange={(e) => updateCondition(i, { value: e.target.value })}
                placeholder="Value"
                className="h-7 flex-1 bg-surface-2 border-edge-dim text-zinc-300 text-[11px] font-mono"
              />
            )}
            <button
              type="button"
              onClick={() => removeCondition(i)}
              className="text-zinc-600 hover:text-zinc-400 transition-colors shrink-0 mt-1"
              disabled={conditions.length <= 1}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addCondition}
        className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <Plus size={11} />
        Add Condition
      </button>
    </div>
  );
}
