import { SUPPORTED_CHAINS } from "@6flow/shared/model/node";
import { SelectField } from "./SelectField";

interface ChainSelectorFieldProps {
  label?: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
}

function formatChainLabel(chain: string): string {
  return chain
    .split("-")
    .map((part) => {
      if (part === "testnet") return "";
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .filter(Boolean)
    .join(" ");
}

const CHAIN_OPTIONS = SUPPORTED_CHAINS.map((chain) => ({
  value: chain,
  label: formatChainLabel(chain),
}));

export function ChainSelectorField({
  label = "Chain",
  description,
  value,
  onChange,
}: ChainSelectorFieldProps) {
  return (
    <SelectField
      label={label}
      description={description}
      value={value}
      onChange={onChange}
      options={CHAIN_OPTIONS}
      placeholder="Select chain..."
    />
  );
}
