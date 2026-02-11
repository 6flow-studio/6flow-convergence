import { FieldLabel } from "./FieldLabel";

interface TextareaFieldProps {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  mono?: boolean;
}

export function TextareaField({
  label,
  description,
  value,
  onChange,
  placeholder,
  rows = 3,
  mono,
}: TextareaFieldProps) {
  return (
    <div>
      <FieldLabel label={label} description={description} />
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`w-full rounded-md border border-edge-dim bg-surface-2 px-2.5 py-2 text-[12px] text-zinc-300 hover:border-edge-bright focus:border-accent-blue focus:outline-none transition-colors resize-none ${mono ? "font-mono" : ""}`}
      />
    </div>
  );
}
