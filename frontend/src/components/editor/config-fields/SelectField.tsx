import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldLabel } from "./FieldLabel";

interface SelectFieldProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function SelectField({
  label,
  description,
  value,
  onChange,
  options,
  placeholder,
}: SelectFieldProps) {
  return (
    <div>
      <FieldLabel label={label} description={description} />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          size="sm"
          className="w-full bg-surface-2 border-edge-dim text-zinc-300 text-[12px] hover:border-edge-bright focus:border-accent-blue transition-colors"
        >
          <SelectValue placeholder={placeholder ?? "Select..."} />
        </SelectTrigger>
        <SelectContent className="bg-surface-2 border-edge-dim">
          {options.map((opt) => (
            <SelectItem
              key={opt.value}
              value={opt.value}
              className="text-[12px] text-zinc-300 focus:bg-surface-3 focus:text-zinc-200"
            >
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
