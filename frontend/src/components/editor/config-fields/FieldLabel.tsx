interface FieldLabelProps {
  label: string;
  description?: string;
}

export function FieldLabel({ label, description }: FieldLabelProps) {
  return (
    <div className="mb-1">
      <label className="text-[11px] text-zinc-500 block font-medium">
        {label}
      </label>
      {description && (
        <span className="text-[10px] text-zinc-600 block mt-0.5">
          {description}
        </span>
      )}
    </div>
  );
}
