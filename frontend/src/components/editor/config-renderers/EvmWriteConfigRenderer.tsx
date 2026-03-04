"use client";

import { TextField, CollapsibleSection } from "../config-fields";
import { ChainSelectorField } from "../config-fields/ChainSelectorField";
import { DroppableInput } from "../config-fields/DroppableInput";
import type { EvmWriteConfig } from "@6flow/shared/model/node";

interface Props {
  config: EvmWriteConfig;
  onChange: (patch: Record<string, unknown>) => void;
  isTestnet?: boolean;
}

export function EvmWriteConfigRenderer({ config, onChange, isTestnet }: Props) {
  return (
    <div className="space-y-3">
      <ChainSelectorField
        value={config.chainSelectorName}
        onChange={(chainSelectorName) => onChange({ chainSelectorName })}
        isTestnet={isTestnet}
      />

      <TextField
        label="Receiver Address"
        value={config.receiverAddress}
        onChange={(receiverAddress) => onChange({ receiverAddress })}
        placeholder="0x..."
        mono
      />

      <TextField
        label="Gas Limit"
        description="Max 5000000"
        value={config.gasLimit}
        onChange={(gasLimit) => onChange({ gasLimit })}
        placeholder="500000"
        mono
      />

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">
          Encoded Data
        </label>
        <DroppableInput
          value={config.encodedData}
          onChange={(encodedData) => onChange({ encodedData })}
          mode="replace"
          placeholder="Drop encoded data reference here"
          className="w-full px-2 py-1.5 rounded border border-border bg-bg-secondary text-sm font-mono text-text-primary"
        />
        <p className="text-[10px] text-text-tertiary mt-0.5">
          Reference to an upstream ABI Encode node output, e.g. {"{{encode-1.encoded}}"}
        </p>
      </div>

      <CollapsibleSection label="Advanced">
        <TextField
          label="Value (wei)"
          description="Native currency amount (optional)"
          value={config.value ?? ""}
          onChange={(v) => onChange({ value: v || undefined })}
          placeholder="0"
          mono
        />
      </CollapsibleSection>
    </div>
  );
}
