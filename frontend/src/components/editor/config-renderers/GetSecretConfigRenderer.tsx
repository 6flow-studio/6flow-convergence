"use client";

import { TextField } from "../config-fields";
import type { GetSecretConfig } from "@6flow/shared/model/node";

interface Props {
  config: GetSecretConfig;
  onChange: (patch: Record<string, unknown>) => void;
}

export function GetSecretConfigRenderer({ config, onChange }: Props) {
  return (
    <div className="space-y-3">
      <TextField
        label="Secret Name"
        description="Name from secrets.yaml"
        value={config.secretName}
        onChange={(secretName) => onChange({ secretName })}
        placeholder="MY_API_KEY"
        mono
      />
    </div>
  );
}
