"use client";

import { TextField, TextareaField, CollapsibleSection } from "../config-fields";
import { ChainSelectorField } from "../config-fields/ChainSelectorField";
import type {
  MintTokenConfig,
  BurnTokenConfig,
  TransferTokenConfig,
} from "@6flow/shared/model/node";

type TokenConfig = MintTokenConfig | BurnTokenConfig | TransferTokenConfig;

interface Props {
  variant: "mint" | "burn" | "transfer";
  config: TokenConfig;
  onChange: (patch: Record<string, unknown>) => void;
  isTestnet?: boolean;
}

const VARIANT_FIELD: Record<string, { label: string; key: string }> = {
  mint: { label: "Recipient Source", key: "recipientSource" },
  burn: { label: "From Source", key: "fromSource" },
  transfer: { label: "To Source", key: "toSource" },
};

function getAddressSource(config: TokenConfig, variant: string): string {
  const key = VARIANT_FIELD[variant].key;
  return (config as unknown as Record<string, unknown>)[key] as string ?? "";
}

export function TokenNodeConfigRenderer({ variant, config, onChange, isTestnet }: Props) {
  const field = VARIANT_FIELD[variant];

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

      <TextField
        label={field.label}
        description="{{nodeId.field}} reference"
        value={getAddressSource(config, variant)}
        onChange={(v) => onChange({ [field.key]: v })}
        placeholder="{{kyc.wallet}}"
        mono
      />

      <TextField
        label="Amount Source"
        value={config.amountSource}
        onChange={(amountSource) => onChange({ amountSource })}
        placeholder="{{calc.amount}}"
        mono
      />

      <CollapsibleSection label="ABI & Gas">
        <TextField
          label="Gas Limit"
          value={config.gasLimit}
          onChange={(gasLimit) => onChange({ gasLimit })}
          placeholder="500000"
          mono
        />
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
