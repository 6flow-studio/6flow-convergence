"use client";

import {
  TextField,
  SelectField,
  TextareaField,
  CollapsibleSection,
} from "../config-fields";
import { ChainSelectorField } from "../config-fields/ChainSelectorField";
import { EvmArgEditor } from "../config-fields/EvmArgEditor";
import type { EvmReadConfig } from "@6flow/shared/model/node";

interface Props {
  config: EvmReadConfig;
  onChange: (patch: Record<string, unknown>) => void;
}

const BLOCK_OPTIONS = [
  { value: "latest", label: "Latest" },
  { value: "finalized", label: "Finalized" },
  { value: "custom", label: "Custom" },
];

export function EvmReadConfigRenderer({ config, onChange }: Props) {
  const blockMode =
    config.blockNumber === "latest" || config.blockNumber === "finalized"
      ? config.blockNumber
      : config.blockNumber
        ? "custom"
        : "latest";

  return (
    <div className="space-y-3">
      <ChainSelectorField
        value={config.chainSelectorName}
        onChange={(chainSelectorName) => onChange({ chainSelectorName })}
      />

      <TextField
        label="Contract Address"
        value={config.contractAddress}
        onChange={(contractAddress) => onChange({ contractAddress })}
        placeholder="0x..."
        mono
      />

      <TextField
        label="Function Name"
        value={config.functionName}
        onChange={(functionName) => onChange({ functionName })}
        placeholder="balanceOf"
        mono
      />

      <EvmArgEditor
        label="Arguments"
        value={config.args}
        onChange={(args) => onChange({ args })}
      />

      <CollapsibleSection label="ABI">
        <TextareaField
          label="Function ABI"
          description="Full ABI function JSON"
          value={config.abi ? JSON.stringify(config.abi, null, 2) : ""}
          onChange={(v) => {
            try {
              onChange({ abi: JSON.parse(v) });
            } catch {
              // ignore invalid JSON while typing
            }
          }}
          rows={5}
          mono
        />
      </CollapsibleSection>

      <CollapsibleSection label="Advanced">
        <TextField
          label="From Address"
          description="Sender address (optional)"
          value={config.fromAddress ?? ""}
          onChange={(fromAddress) => onChange({ fromAddress: fromAddress || undefined })}
          placeholder="0x..."
          mono
        />
        <SelectField
          label="Block Number"
          value={blockMode}
          onChange={(v) => {
            if (v === "custom") return;
            onChange({ blockNumber: v });
          }}
          options={BLOCK_OPTIONS}
        />
        {blockMode === "custom" && (
          <TextField
            label="Custom Block"
            value={typeof config.blockNumber === "string" && config.blockNumber !== "latest" && config.blockNumber !== "finalized" ? config.blockNumber : ""}
            onChange={(blockNumber) => onChange({ blockNumber })}
            placeholder="Block number"
            mono
          />
        )}
      </CollapsibleSection>
    </div>
  );
}
