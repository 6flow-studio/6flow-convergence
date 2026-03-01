import { safeJsonStringify } from "@/lib/node-execution/schema";
import type { DataSchema } from "@6flow/shared/model/node";

export function SchemaTree({ schema }: { schema: DataSchema }) {
  return (
    <div className="space-y-1">
      <SchemaNode schema={schema} label="root" depth={0} />
    </div>
  );
}

function SchemaNode({
  schema,
  label,
  depth,
}: {
  schema: DataSchema;
  label: string;
  depth: number;
}) {
  const rowStyle = { paddingLeft: `${depth * 12}px` };

  return (
    <div className="space-y-1">
      <div
        style={rowStyle}
        className="flex items-center gap-2 rounded px-1.5 py-1 text-[11px] text-zinc-300"
      >
        <span className="font-mono text-zinc-200">{label}</span>
        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.06em] text-zinc-500">
          {schema.type}
        </span>
        {schema.path && (
          <span className="font-mono text-[10px] text-zinc-600">{schema.path}</span>
        )}
      </div>

      {schema.fields?.map((field: NonNullable<DataSchema["fields"]>[number]) => (
        <SchemaNode
          key={field.path}
          schema={field.schema}
          label={field.optional ? `${field.key}?` : field.key}
          depth={depth + 1}
        />
      ))}

      {schema.itemSchema && (
        <SchemaNode
          schema={schema.itemSchema}
          label="[]"
          depth={depth + 1}
        />
      )}
    </div>
  );
}

export function PreviewCode({ value }: { value: unknown }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-edge-dim bg-surface-2 px-2.5 py-2 text-[11px] leading-relaxed text-zinc-300">
      {safeJsonStringify(value)}
    </pre>
  );
}
