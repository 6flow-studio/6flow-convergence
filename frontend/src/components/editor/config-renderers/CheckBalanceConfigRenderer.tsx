"use client";

import { TextField, ExpressionTextField, TextareaField, CollapsibleSection } from "../config-fields";
import { ChainSelectorField } from "../config-fields/ChainSelectorField";
import type { CheckBalanceConfig } from "@6flow/shared/model/node";

interface Props {
  config: CheckBalanceConfig;
  onChange: (patch: Record<string, unknown>) => void;
  isTestnet?: boolean;
}

export function CheckBalanceConfigRenderer({ config, onChange, isTestnet }: Props) {
  return (
    <div className="space-y-3">
      <ChainSelectorField
        value={config.chainSelectorName}
        onChange={(chainSelectorName) => onChange({ chainSelectorName })}
        isTestnet={isTestnet}
      />

      <TextField
        label="Token Contract"
        value={config.tokenContractAddress}
        onChange={(tokenContractAddress) => onChange({ tokenContractAddress })}
        placeholder="0x..."
        mono
      />

      <ExpressionTextField
        label="Address Source"
        description="{{nodeId.field}} reference"
        value={config.addressSource}
        onChange={(addressSource) => onChange({ addressSource })}
        placeholder="{{trigger.address}}"
        mono
      />

      <CollapsibleSection label="ABI">
        <TextareaField
          label="Token ABI"
          description="ABI function JSON"
          value={config.tokenAbi ? JSON.stringify(config.tokenAbi, null, 2) : ""}
          onChange={(v) => {
            try {
              onChange({ tokenAbi: JSON.parse(v) });
            } catch {
              // ignore invalid JSON while typing
            }
          }}
          rows={4}
          mono
        />
      </CollapsibleSection>
    </div>
  );
}
