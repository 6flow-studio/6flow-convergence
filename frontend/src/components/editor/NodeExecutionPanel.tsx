"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEditorStore, type WorkflowNode } from "@/lib/editor-store";
import { buildWorkflowInput } from "@/lib/compiler/build-workflow-input";
import {
  isExecutionPreviewSupported,
  type ExecuteNodeErrorResponse,
  type ExecuteNodeResponse,
} from "@/lib/node-execution/shared";
import { safeJsonStringify } from "@/lib/node-execution/schema";
import { CollapsibleSection } from "./config-fields";
import type { DataSchema } from "@6flow/shared/model/node";

interface NodeExecutionPanelProps {
  node: WorkflowNode;
}

type ExecutionStatus = "idle" | "running";

export function NodeExecutionPanel({ node }: NodeExecutionPanelProps) {
  const updateNodeEditor = useEditorStore((state) => state.updateNodeEditor);
  const workflowName = useEditorStore((state) => state.workflowName);
  const workflowId = useEditorStore((state) => state.workflowId);
  const workflowCreatedAt = useEditorStore((state) => state.workflowCreatedAt);
  const workflowGlobalConfig = useEditorStore((state) => state.workflowGlobalConfig);
  const nodes = useEditorStore((state) => state.nodes);
  const edges = useEditorStore((state) => state.edges);

  const [status, setStatus] = useState<ExecutionStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const preview = node.data.editor?.lastExecution;
  const schema = node.data.editor?.outputSchema;
  const disabledReason = useMemo(
    () => getExecuteDisabledReason(node),
    [node],
  );

  if (!isExecutionPreviewSupported(node.data.nodeType)) {
    return null;
  }

  async function onExecute() {
    setStatus("running");
    setError(null);

    try {
      const workflow = buildWorkflowInput({
        workflowId,
        workflowName,
        workflowCreatedAt,
        workflowGlobalConfig,
        nodes,
        edges,
      });

      const response = await fetch("/api/editor/nodes/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workflow,
          nodeId: node.id,
        }),
      });

      const payload =
        (await response.json()) as ExecuteNodeResponse | ExecuteNodeErrorResponse;

      if (!response.ok) {
        setError(
          "error" in payload ? payload.error : "Node execution preview failed.",
        );
        return;
      }

      const result = payload as ExecuteNodeResponse;
      updateNodeEditor(node.id, {
        lastExecution: result.preview,
        outputSchema: result.schema,
        schemaSource: "executed",
        executedAt: result.executedAt,
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Node execution preview failed.",
      );
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.08em]">
            Execution Preview
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
            Runs the current node with its saved config and upstream executed outputs.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void onExecute()}
          disabled={status === "running" || Boolean(disabledReason)}
          className="border-edge-dim bg-surface-2 text-zinc-200 hover:bg-surface-3"
          title={disabledReason ?? undefined}
        >
          {status === "running" ? (
            <>
              <Loader2 className="animate-spin" />
              Executing...
            </>
          ) : preview ? (
            <>
              <RefreshCw />
              Execute
            </>
          ) : (
            <>
              <Play />
              Execute
            </>
          )}
        </Button>
      </div>

      {disabledReason && (
        <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-200">
          {disabledReason}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-500/25 bg-red-500/10 px-2.5 py-2 space-y-1">
          <div className="flex items-center gap-1.5 text-red-300 text-[11px] font-semibold">
            <AlertTriangle size={12} />
            <span>Execution failed</span>
          </div>
          <div className="text-[11px] text-zinc-300 leading-relaxed">{error}</div>
        </div>
      )}

      {preview && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="border-0 bg-emerald-500/15 text-[10px] font-semibold text-emerald-300"
            >
              executed
            </Badge>
            {node.data.editor?.executedAt && (
              <span className="text-[11px] text-zinc-500">
                {new Date(node.data.editor.executedAt).toLocaleString()}
              </span>
            )}
          </div>

          {preview.warnings && preview.warnings.length > 0 && (
            <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2.5 py-2 space-y-1">
              {preview.warnings.map((warning: string) => (
                <div key={warning} className="text-[11px] text-amber-100">
                  {warning}
                </div>
              ))}
            </div>
          )}

          <CollapsibleSection label="Output Schema" defaultOpen>
            {schema ? (
              <SchemaTree schema={schema} />
            ) : (
              <div className="text-[11px] text-zinc-500">No schema available.</div>
            )}
          </CollapsibleSection>

          <CollapsibleSection label="Normalized Output" defaultOpen>
            <PreviewCode value={preview.normalized} />
          </CollapsibleSection>

          <CollapsibleSection label="Raw Output">
            <PreviewCode value={preview.raw} />
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}

function SchemaTree({ schema }: { schema: DataSchema }) {
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

function PreviewCode({ value }: { value: unknown }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-edge-dim bg-surface-2 px-2.5 py-2 text-[11px] leading-relaxed text-zinc-300">
      {safeJsonStringify(value)}
    </pre>
  );
}

function getExecuteDisabledReason(node: WorkflowNode): string | null {
  switch (node.data.nodeType) {
    case "httpRequest":
      return typeof node.data.config.url === "string" && node.data.config.url.trim()
        ? null
        : "HTTP URL is required before execution preview can run.";
    case "ai": {
      const { model, baseUrl, apiKeySecret } = node.data.config;
      if (typeof model !== "string" || !model.trim()) {
        return "AI model is required before execution preview can run.";
      }
      if (typeof baseUrl !== "string" || !baseUrl.trim()) {
        return "AI base URL is required before execution preview can run.";
      }
      if (typeof apiKeySecret !== "string" || !apiKeySecret.trim()) {
        return "AI API key secret is required before execution preview can run.";
      }
      return null;
    }
    case "evmRead": {
      const { contractAddress, functionName, abi, chainSelectorName, args } =
        node.data.config;
      if (typeof chainSelectorName !== "string" || !chainSelectorName.trim()) {
        return "Chain selection is required before execution preview can run.";
      }
      if (typeof contractAddress !== "string" || !contractAddress.trim()) {
        return "Contract address is required before execution preview can run.";
      }
      if (typeof functionName !== "string" || !functionName.trim()) {
        return "Function name is required before execution preview can run.";
      }
      if (!abi || typeof abi !== "object") {
        return "Function ABI is required before execution preview can run.";
      }
      const abiInputs = Array.isArray((abi as { inputs?: unknown[] }).inputs)
        ? (abi as { inputs: unknown[] }).inputs
        : [];
      if (!Array.isArray(args) || args.length !== abiInputs.length) {
        return "Arguments must match the ABI input count before execution preview can run.";
      }
      return null;
    }
    case "evmWrite": {
      const { chainSelectorName, receiverAddress, abiParams, dataMapping } =
        node.data.config;
      if (typeof chainSelectorName !== "string" || !chainSelectorName.trim()) {
        return "Chain selection is required before execution preview can run.";
      }
      if (typeof receiverAddress !== "string" || !receiverAddress.trim()) {
        return "Receiver address is required before execution preview can run.";
      }
      if (!Array.isArray(abiParams) || abiParams.length === 0) {
        return "At least one ABI parameter is required before execution preview can run.";
      }
      if (!Array.isArray(dataMapping) || dataMapping.length !== abiParams.length) {
        return "Data mapping must match the ABI parameter count before execution preview can run.";
      }
      return null;
    }
    default:
      return "Execution preview is not supported for this node type yet.";
  }
}
