import { Input } from "@/components/ui/input";
import { FieldLabel } from "./FieldLabel";

interface TextFieldProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
}

export function TextField({
  label,
  description,
  value,
  onChange,
  placeholder,
  mono,
}: TextFieldProps) {
  return (
    <div>
      <FieldLabel label={label} description={description} />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`h-8 bg-surface-2 border-edge-dim text-zinc-300 text-[12px] hover:border-edge-bright focus:border-accent-blue transition-colors ${mono ? "font-mono" : ""}`}
      />
    </div>
  );
}
