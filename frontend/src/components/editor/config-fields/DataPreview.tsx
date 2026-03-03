import { safeJsonStringify } from "@/lib/node-execution/schema";
import { FIELD_REF_MIME, encodeFieldRef } from "@/lib/drag-field-ref";
import type { DataSchema } from "@6flow/shared/model/node";

export function SchemaTree({
  schema,
  upstreamNodeId,
  upstreamNodeName,
}: {
  schema: DataSchema;
  upstreamNodeId?: string;
  upstreamNodeName?: string;
}) {
  return (
    <div className="space-y-1">
      <SchemaNode
        schema={schema}
        label="root"
        depth={0}
        upstreamNodeId={upstreamNodeId}
        upstreamNodeName={upstreamNodeName}
      />
    </div>
  );
}

function SchemaNode({
  schema,
  label,
  depth,
  upstreamNodeId,
  upstreamNodeName,
}: {
  schema: DataSchema;
  label: string;
  depth: number;
  upstreamNodeId?: string;
  upstreamNodeName?: string;
}) {
  const rowStyle = { paddingLeft: `${depth * 12}px` };
  const isDraggable = !!upstreamNodeId && !!schema.path;

  function onDragStart(e: React.DragEvent) {
    if (!upstreamNodeId || !schema.path) return;
    const data = encodeFieldRef({
      nodeId: upstreamNodeId,
      nodeName: upstreamNodeName ?? upstreamNodeId,
      path: schema.path,
    });
    e.dataTransfer.setData(FIELD_REF_MIME, data);
    e.dataTransfer.effectAllowed = "copy";

    // Custom drag image showing {{nodeName.path}}
    const displayName = upstreamNodeName ?? upstreamNodeId;
    const badge = document.createElement("div");
    badge.textContent = `{{${displayName}.${schema.path}}}`;
    badge.style.cssText =
      "position:fixed;left:-9999px;padding:2px 8px;border-radius:4px;background:#3b82f6;color:#fff;font-size:11px;font-family:monospace;white-space:nowrap;";
    document.body.appendChild(badge);
    e.dataTransfer.setDragImage(badge, 0, 0);
    requestAnimationFrame(() => badge.remove());
  }

  return (
    <div className="space-y-1">
      <div
        style={rowStyle}
        draggable={isDraggable}
        onDragStart={isDraggable ? onDragStart : undefined}
        className={`flex items-center gap-2 rounded px-1.5 py-1 text-[11px] text-zinc-300 ${
          isDraggable
            ? "cursor-grab hover:bg-surface-3 active:cursor-grabbing"
            : ""
        }`}
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
          upstreamNodeId={upstreamNodeId}
          upstreamNodeName={upstreamNodeName}
        />
      ))}

      {schema.itemSchema && (
        <SchemaNode
          schema={schema.itemSchema}
          label="[]"
          depth={depth + 1}
          upstreamNodeId={upstreamNodeId}
          upstreamNodeName={upstreamNodeName}
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
