"use client";

import { SelectField, TextareaField, BooleanField } from "../config-fields";
import type { NodeSettings, LogLevel } from "@6flow/shared/model/node";

interface Props {
  settings: NodeSettings | undefined;
  onChange: (patch: Partial<NodeSettings>) => void;
}

const LOG_LEVEL_OPTIONS = [
  { value: "debug", label: "Debug" },
  { value: "info", label: "Info" },
  { value: "warn", label: "Warn" },
  { value: "error", label: "Error" },
];

export function NodeSettingsPanel({ settings, onChange }: Props) {
  const logEnabled = !!settings?.log;
  const logLevel = settings?.log?.level ?? "info";
  const logMessage = settings?.log?.messageTemplate ?? "";
  const returnExpr = settings?.returnExpression ?? "";

  return (
    <div className="space-y-3">
      {/* Return Expression */}
      <TextareaField
        label="Return Expression"
        description="Optional custom return value for leaf nodes (overrides default auto-return)"
        value={returnExpr}
        onChange={(returnExpression) =>
          onChange({ returnExpression: returnExpression || undefined })
        }
        placeholder='e.g. "Minted successfully"'
        rows={2}
        mono
      />

      {/* Log Toggle + Settings */}
      <BooleanField
        label="Enable Logging"
        description="Emit a log line after this node executes"
        value={logEnabled}
        onChange={(enabled) => {
          if (enabled) {
            onChange({ log: { level: "info", messageTemplate: "" } });
          } else {
            onChange({ log: undefined });
          }
        }}
      />

      {logEnabled && (
        <>
          <SelectField
            label="Log Level"
            value={logLevel}
            onChange={(level) =>
              onChange({ log: { level: level as LogLevel, messageTemplate: logMessage } })
            }
            options={LOG_LEVEL_OPTIONS}
          />
          <TextareaField
            label="Log Message"
            description="Supports {{variable}} interpolation"
            value={logMessage}
            onChange={(messageTemplate) =>
              onChange({ log: { level: logLevel, messageTemplate } })
            }
            placeholder="User {{id}} completed action"
            rows={3}
          />
        </>
      )}
    </div>
  );
}
