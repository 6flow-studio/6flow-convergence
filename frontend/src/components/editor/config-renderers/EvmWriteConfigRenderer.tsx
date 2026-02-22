"use client";

import { TextField, CollapsibleSection } from "../config-fields";
import { ChainSelectorField } from "../config-fields/ChainSelectorField";
import { AbiParamsEditor } from "../config-fields/AbiParamsEditor";
import { EvmArgEditor } from "../config-fields/EvmArgEditor";
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

      <AbiParamsEditor
        label="ABI Parameters"
        value={config.abiParams}
        onChange={(abiParams) => onChange({ abiParams })}
      />

      <EvmArgEditor
        label="Data Mapping"
        value={config.dataMapping}
        onChange={(dataMapping) => onChange({ dataMapping })}
      />

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
