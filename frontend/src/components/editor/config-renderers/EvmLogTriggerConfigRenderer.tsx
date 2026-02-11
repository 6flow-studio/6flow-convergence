"use client";

import {
  TextField,
  SelectField,
  TagInput,
  CollapsibleSection,
} from "../config-fields";
import { ChainSelectorField } from "../config-fields/ChainSelectorField";
import { AbiParamsEditor } from "../config-fields/AbiParamsEditor";
import type { EvmLogTriggerConfig, AbiParameter } from "@6flow/shared/model/node";

interface Props {
  config: EvmLogTriggerConfig;
  onChange: (patch: Record<string, unknown>) => void;
}

const BLOCK_CONFIRMATION_OPTIONS = [
  { value: "latest", label: "Latest" },
  { value: "finalized", label: "Finalized" },
];

export function EvmLogTriggerConfigRenderer({ config, onChange }: Props) {
  const eventAbi = config.eventAbi ?? { type: "event" as const, name: "", inputs: [] };
  const topicFilters = config.topicFilters ?? {};

  return (
    <div className="space-y-3">
      <ChainSelectorField
        value={config.chainSelectorName}
        onChange={(chainSelectorName) => onChange({ chainSelectorName })}
      />

      <TagInput
        label="Contract Addresses"
        description="Max 5 addresses"
        value={config.contractAddresses}
        onChange={(contractAddresses) => onChange({ contractAddresses })}
        placeholder="0x... and press Enter"
      />

      <TextField
        label="Event Signature"
        value={config.eventSignature}
        onChange={(eventSignature) => onChange({ eventSignature })}
        placeholder="Transfer(address,address,uint256)"
        mono
      />

      <SelectField
        label="Block Confirmation"
        value={config.blockConfirmation ?? "finalized"}
        onChange={(blockConfirmation) => onChange({ blockConfirmation })}
        options={BLOCK_CONFIRMATION_OPTIONS}
      />

      <CollapsibleSection label="Event ABI">
        <TextField
          label="Event Name"
          value={eventAbi.name}
          onChange={(name) =>
            onChange({ eventAbi: { ...eventAbi, name } })
          }
          placeholder="Transfer"
        />
        <AbiParamsEditor
          label="Parameters"
          value={eventAbi.inputs}
          onChange={(inputs: AbiParameter[]) =>
            onChange({ eventAbi: { ...eventAbi, inputs } })
          }
          showIndexed
        />
      </CollapsibleSection>

      <CollapsibleSection label="Topic Filters">
        <TagInput
          label="Topic 1"
          value={topicFilters.topic1 ?? []}
          onChange={(topic1) =>
            onChange({ topicFilters: { ...topicFilters, topic1 } })
          }
          placeholder="Filter values..."
        />
        <TagInput
          label="Topic 2"
          value={topicFilters.topic2 ?? []}
          onChange={(topic2) =>
            onChange({ topicFilters: { ...topicFilters, topic2 } })
          }
          placeholder="Filter values..."
        />
        <TagInput
          label="Topic 3"
          value={topicFilters.topic3 ?? []}
          onChange={(topic3) =>
            onChange({ topicFilters: { ...topicFilters, topic3 } })
          }
          placeholder="Filter values..."
        />
      </CollapsibleSection>
    </div>
  );
}
