"use client";

import { TextField, BooleanField } from "../config-fields";
import type { JsonParseConfig } from "@6flow/shared/model/node";

interface Props {
  config: JsonParseConfig;
  onChange: (patch: Record<string, unknown>) => void;
}

export function JsonParseConfigRenderer({ config, onChange }: Props) {
  return (
    <div className="space-y-3">
      <TextField
        label="Source Path"
        description="JSONPath expression"
        value={config.sourcePath ?? ""}
        onChange={(sourcePath) => onChange({ sourcePath })}
        placeholder="$.data[0]"
        mono
      />
      <BooleanField
        label="Strict"
        description="Throw on invalid JSON"
        value={config.strict ?? true}
        onChange={(strict) => onChange({ strict })}
      />
    </div>
  );
}
