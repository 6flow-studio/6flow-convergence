import { Input } from "@/components/ui/input";
import { FieldLabel } from "./FieldLabel";

interface NumberFieldProps {
  label: string;
  description?: string;
  value: number | undefined;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

export function NumberField({
  label,
  description,
  value,
  onChange,
  min,
  max,
  step,
  placeholder,
}: NumberFieldProps) {
  return (
    <div>
      <FieldLabel label={label} description={description} />
      <Input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        className="h-8 bg-surface-2 border-edge-dim text-zinc-300 text-[12px] font-mono hover:border-edge-bright focus:border-accent-blue transition-colors"
      />
    </div>
  );
}
