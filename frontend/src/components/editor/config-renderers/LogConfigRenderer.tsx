"use client";

import { SelectField, TextareaField } from "../config-fields";
import type { LogConfig } from "@6flow/shared/model/node";

interface Props {
  config: LogConfig;
  onChange: (patch: Record<string, unknown>) => void;
}

const LOG_LEVEL_OPTIONS = [
  { value: "debug", label: "Debug" },
  { value: "info", label: "Info" },
  { value: "warn", label: "Warn" },
  { value: "error", label: "Error" },
];

export function LogConfigRenderer({ config, onChange }: Props) {
  return (
    <div className="space-y-3">
      <SelectField
        label="Level"
        value={config.level}
        onChange={(level) => onChange({ level })}
        options={LOG_LEVEL_OPTIONS}
      />
      <TextareaField
        label="Message Template"
        description="Supports {{variable}} interpolation"
        value={config.messageTemplate}
        onChange={(messageTemplate) => onChange({ messageTemplate })}
        placeholder="User {{id}} completed action"
        rows={3}
      />
    </div>
  );
}
