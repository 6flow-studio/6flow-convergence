"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  TextField,
  SelectField,
  TextareaField,
  CollapsibleSection,
} from "../config-fields";
import { ChainSelectorField } from "../config-fields/ChainSelectorField";
import { EvmArgEditor } from "../config-fields/EvmArgEditor";
import { appendFieldPath, abiParamToSchema } from "../config-fields/abi-schema";
import type { EvmReadConfig, AbiFunction, DataSchema } from "@6flow/shared/model/node";
import { useEditorStore } from "@/lib/editor-store";

interface Props {
  config: EvmReadConfig;
  onChange: (patch: Record<string, unknown>) => void;
  isTestnet?: boolean;
  nodeId?: string;
}

function deriveEvmReadOutputSchema(abi: AbiFunction): DataSchema {
  const outputs = abi.outputs ?? [];
  return {
    type: "object",
    path: "",
    fields: outputs.map((param, index) => {
      const key = param.name || (outputs.length === 1 ? "value" : `output${index}`);
      const path = appendFieldPath("", key);
      return { key, path, schema: abiParamToSchema(param, path) };
    }),
  };
}

const BLOCK_OPTIONS = [
  { value: "latest", label: "Latest" },
  { value: "finalized", label: "Finalized" },
  { value: "custom", label: "Custom" },
];

type AbiFetchStatus = "idle" | "loading" | "success" | "not_verified" | "error";

const isValidAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);

export function EvmReadConfigRenderer({ config, onChange, isTestnet, nodeId }: Props) {
  const updateNodeEditor = useEditorStore((state) => state.updateNodeEditor);

  useEffect(() => {
    if (!nodeId || !config.abi?.outputs) return;
    updateNodeEditor(nodeId, {
      outputSchema: deriveEvmReadOutputSchema(config.abi),
      schemaSource: "derived",
    });
  }, [config.abi, nodeId, updateNodeEditor]);

  const [contractAbi, setContractAbi] = useState<AbiFunction[]>(() => {
    // Initialize from cached ABI if it matches current address/chain
    const cached = config.cachedAbi;
    if (
      cached &&
      cached.address === config.contractAddress &&
      cached.chain === config.chainSelectorName
    ) {
      return cached.functions;
    }
    return [];
  });
  const [abiFetchStatus, setAbiFetchStatus] = useState<AbiFetchStatus>(() => {
    const cached = config.cachedAbi;
    if (
      cached &&
      cached.address === config.contractAddress &&
      cached.chain === config.chainSelectorName
    ) {
      return "success";
    }
    return "idle";
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Auto-fetch ABI when address and chain are set
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (
      !config.chainSelectorName ||
      !config.contractAddress ||
      !isValidAddress(config.contractAddress)
    ) {
      setAbiFetchStatus("idle");
      setContractAbi([]);
      return;
    }

    // Use cached ABI if it matches current address/chain
    const cached = config.cachedAbi;
    if (
      cached &&
      cached.address === config.contractAddress &&
      cached.chain === config.chainSelectorName
    ) {
      setContractAbi(cached.functions);
      setAbiFetchStatus("success");
      return;
    }

    setAbiFetchStatus("loading");

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/abi?chain=${encodeURIComponent(config.chainSelectorName)}&address=${encodeURIComponent(config.contractAddress)}`,
        );
        const data = await res.json();

        if (res.ok && data.abi) {
          const functions: AbiFunction[] = data.abi.filter(
            (entry: AbiFunction) =>
              entry.type === "function" &&
              (entry.stateMutability === "view" ||
                entry.stateMutability === "pure"),
          );
          setContractAbi(functions);
          setAbiFetchStatus("success");
          // Cache the fetched ABI on the node
          onChange({
            cachedAbi: {
              address: config.contractAddress,
              chain: config.chainSelectorName,
              functions,
            },
          });
        } else if (data.error === "not_verified") {
          setAbiFetchStatus("not_verified");
          setContractAbi([]);
        } else {
          setAbiFetchStatus("error");
          setContractAbi([]);
        }
      } catch {
        setAbiFetchStatus("error");
        setContractAbi([]);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [config.contractAddress, config.chainSelectorName]);

  const functionOptions = useMemo(
    () => contractAbi.map((fn) => ({ value: fn.name, label: fn.name })),
    [contractAbi],
  );

  const handleFunctionSelect = (functionName: string) => {
    const abiEntry = contractAbi.find((fn) => fn.name === functionName);
    if (abiEntry) {
      onChange({
        functionName,
        abi: abiEntry,
        args: abiEntry.inputs.map((input) => ({
          type: "literal" as const,
          value: "",
          abiType: input.type,
        })),
      });
    } else {
      onChange({ functionName });
    }
  };

  const blockMode =
    config.blockNumber === "latest" || config.blockNumber === "finalized"
      ? config.blockNumber
      : config.blockNumber
        ? "custom"
        : "latest";

  return (
    <div className="space-y-3">
      <ChainSelectorField
        value={config.chainSelectorName}
        onChange={(chainSelectorName) => onChange({ chainSelectorName })}
        isTestnet={isTestnet}
      />

      <div>
        <TextField
          label="Contract Address"
          value={config.contractAddress}
          onChange={(contractAddress) => onChange({ contractAddress })}
          placeholder="0x..."
          mono
        />
        <AbiStatusIndicator status={abiFetchStatus} />
      </div>

      {abiFetchStatus === "success" && functionOptions.length > 0 ? (
        <SelectField
          label="Function Name"
          value={config.functionName}
          onChange={handleFunctionSelect}
          options={functionOptions}
          placeholder="Select a function..."
        />
      ) : (
        <TextField
          label="Function Name"
          value={config.functionName}
          onChange={(functionName) => onChange({ functionName })}
          placeholder="balanceOf"
          mono
        />
      )}

      <EvmArgEditor
        label="Arguments"
        value={config.args}
        onChange={(args) => onChange({ args })}
      />

      <CollapsibleSection label="ABI">
        <TextareaField
          label="Function ABI"
          description="Full ABI function JSON"
          value={config.abi ? JSON.stringify(config.abi, null, 2) : ""}
          onChange={(v) => {
            try {
              onChange({ abi: JSON.parse(v) });
            } catch {
              // ignore invalid JSON while typing
            }
          }}
          rows={5}
          mono
        />
      </CollapsibleSection>

      <CollapsibleSection label="Advanced">
        <TextField
          label="From Address"
          description="Sender address (optional)"
          value={config.fromAddress ?? ""}
          onChange={(fromAddress) => onChange({ fromAddress: fromAddress || undefined })}
          placeholder="0x..."
          mono
        />
        <SelectField
          label="Block Number"
          value={blockMode}
          onChange={(v) => {
            if (v === "custom") return;
            onChange({ blockNumber: v });
          }}
          options={BLOCK_OPTIONS}
        />
        {blockMode === "custom" && (
          <TextField
            label="Custom Block"
            value={typeof config.blockNumber === "string" && config.blockNumber !== "latest" && config.blockNumber !== "finalized" ? config.blockNumber : ""}
            onChange={(blockNumber) => onChange({ blockNumber })}
            placeholder="Block number"
            mono
          />
        )}
      </CollapsibleSection>
    </div>
  );
}

function AbiStatusIndicator({ status }: { status: AbiFetchStatus }) {
  if (status === "idle") return null;

  const styles: Record<AbiFetchStatus, { text: string; className: string }> = {
    idle: { text: "", className: "" },
    loading: { text: "Fetching ABI...", className: "text-zinc-500" },
    success: { text: "ABI loaded", className: "text-emerald-500" },
    not_verified: {
      text: "Contract not verified — enter ABI manually",
      className: "text-amber-500",
    },
    error: { text: "Failed to fetch ABI", className: "text-red-400" },
  };

  const { text, className } = styles[status];

  return (
    <span className={`text-[10px] mt-1 block ${className}`}>
      {status === "loading" && (
        <span className="inline-block w-3 h-3 border border-zinc-500 border-t-transparent rounded-full animate-spin mr-1 align-text-bottom" />
      )}
      {text}
    </span>
  );
}
