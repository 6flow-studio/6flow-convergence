"use client";

import { TagInput } from "../config-fields";
import { AbiParamsEditor } from "../config-fields/AbiParamsEditor";
import type { AbiDecodeConfig } from "@6flow/shared/model/node";

interface Props {
  config: AbiDecodeConfig;
  onChange: (patch: Record<string, unknown>) => void;
}

export function AbiDecodeConfigRenderer({ config, onChange }: Props) {
  return (
    <div className="space-y-3">
      <AbiParamsEditor
        label="ABI Parameters"
        value={config.abiParams}
        onChange={(abiParams) => onChange({ abiParams })}
      />

      <TagInput
        label="Output Names"
        value={config.outputNames}
        onChange={(outputNames) => onChange({ outputNames })}
        placeholder="Type name and press Enter..."
      />
    </div>
  );
}
