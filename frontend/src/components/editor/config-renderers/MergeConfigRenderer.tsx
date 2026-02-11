"use client";

import {
  SelectField,
  TagInput,
  BooleanField,
  TextareaField,
  NumberField,
  CollapsibleSection,
} from "../config-fields";
import type { MergeConfig, MergeStrategy } from "@6flow/shared/model/node";

interface Props {
  config: MergeConfig;
  onChange: (patch: Record<string, unknown>) => void;
}

const MODE_OPTIONS = [
  { value: "append", label: "Append" },
  { value: "matchingFields", label: "Matching Fields" },
  { value: "position", label: "Position" },
  { value: "combinations", label: "Combinations" },
  { value: "custom", label: "Custom" },
];

const OUTPUT_TYPE_OPTIONS = [
  { value: "keepMatches", label: "Keep Matches" },
  { value: "keepNonMatches", label: "Keep Non-Matches" },
  { value: "keepAll", label: "Keep All" },
  { value: "enrichInput1", label: "Enrich Input 1" },
  { value: "enrichInput2", label: "Enrich Input 2" },
];

const CLASH_OPTIONS = [
  { value: "preferInput1", label: "Prefer Input 1" },
  { value: "preferInput2", label: "Prefer Input 2" },
  { value: "addSuffix", label: "Add Suffix" },
];

function updateStrategy(current: MergeStrategy, mode: string): MergeStrategy {
  switch (mode) {
    case "append":
      return { mode: "append" };
    case "matchingFields":
      return { mode: "matchingFields", joinFields: [], outputType: "keepAll" };
    case "position":
      return { mode: "position", includeUnpaired: false };
    case "combinations":
      return { mode: "combinations" };
    case "custom":
      return { mode: "custom", code: "" };
    default:
      return current;
  }
}

export function MergeConfigRenderer({ config, onChange }: Props) {
  const strategy = config.strategy;

  return (
    <div className="space-y-3">
      <SelectField
        label="Mode"
        value={strategy.mode}
        onChange={(mode) => onChange({ strategy: updateStrategy(strategy, mode) })}
        options={MODE_OPTIONS}
      />

      {strategy.mode === "matchingFields" && (
        <>
          <TagInput
            label="Join Fields"
            value={strategy.joinFields}
            onChange={(joinFields) =>
              onChange({ strategy: { ...strategy, joinFields } })
            }
            placeholder="Field name..."
          />
          <SelectField
            label="Output"
            value={strategy.outputType}
            onChange={(outputType) =>
              onChange({ strategy: { ...strategy, outputType } })
            }
            options={OUTPUT_TYPE_OPTIONS}
          />
        </>
      )}

      {strategy.mode === "position" && (
        <BooleanField
          label="Include Unpaired"
          value={strategy.includeUnpaired ?? false}
          onChange={(includeUnpaired) =>
            onChange({ strategy: { ...strategy, includeUnpaired } })
          }
        />
      )}

      {strategy.mode === "custom" && (
        <TextareaField
          label="Code"
          value={strategy.code}
          onChange={(code) =>
            onChange({ strategy: { ...strategy, code } })
          }
          rows={5}
          mono
        />
      )}

      <CollapsibleSection label="Advanced">
        <NumberField
          label="Number of Inputs"
          value={config.numberOfInputs ?? 2}
          onChange={(numberOfInputs) => onChange({ numberOfInputs })}
          min={2}
          max={5}
        />
        <SelectField
          label="Clash Handling"
          value={config.clashHandling ?? "preferInput1"}
          onChange={(clashHandling) => onChange({ clashHandling })}
          options={CLASH_OPTIONS}
        />
      </CollapsibleSection>
    </div>
  );
}
