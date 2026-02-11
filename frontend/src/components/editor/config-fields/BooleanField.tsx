import { FieldLabel } from "./FieldLabel";

interface BooleanFieldProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export function BooleanField({
  label,
  description,
  value,
  onChange,
}: BooleanFieldProps) {
  return (
    <div>
      <FieldLabel label={label} description={description} />
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors ${
          value
            ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
            : "bg-surface-3 text-zinc-500 hover:text-zinc-400"
        }`}
      >
        {value ? "true" : "false"}
      </button>
    </div>
  );
}
