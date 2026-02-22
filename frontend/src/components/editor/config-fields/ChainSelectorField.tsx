import { SUPPORTED_CHAINS } from "@6flow/shared/supportedChain";
import { SelectField } from "./SelectField";

interface ChainSelectorFieldProps {
  label?: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  isTestnet?: boolean;
}

const CHAIN_OPTIONS = SUPPORTED_CHAINS.map((chain) => ({
  value: chain.chainSelectorName,
  label: chain.name,
}));

export function ChainSelectorField({
  label = "Chain",
  description,
  value,
  onChange,
  isTestnet,
}: ChainSelectorFieldProps) {
  const options =
    isTestnet !== undefined
      ? SUPPORTED_CHAINS
          .filter((chain) => chain.isTestnet === isTestnet)
          .map((chain) => ({ value: chain.chainSelectorName, label: chain.name }))
      : CHAIN_OPTIONS;

  return (
    <SelectField
      label={label}
      description={description}
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Select chain..."
    />
  );
}
