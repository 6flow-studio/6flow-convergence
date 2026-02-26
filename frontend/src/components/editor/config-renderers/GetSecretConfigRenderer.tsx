"use client";

import { SelectField } from "../config-fields";
import type { GetSecretConfig } from "@6flow/shared/model/node";

interface Props {
  config: GetSecretConfig;
  onChange: (patch: Record<string, unknown>) => void;
  secretNames?: string[];
}

export function GetSecretConfigRenderer({ config, onChange, secretNames = [] }: Props) {
  const options = secretNames.map((name) => ({ value: name, label: name }));

  return (
    <div className="space-y-3">
      <SelectField
        label="Secret Name"
        description="Select a secret defined in Workflow Settings"
        value={config.secretName}
        onChange={(secretName) => onChange({ secretName })}
        options={options}
        placeholder={options.length === 0 ? "No secrets defined" : "Select a secret"}
      />
    </div>
  );
}
