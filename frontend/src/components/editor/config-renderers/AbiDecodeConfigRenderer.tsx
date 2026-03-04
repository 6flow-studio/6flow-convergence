"use client";

import { useEffect } from "react";
import { TagInput } from "../config-fields";
import { AbiParamsEditor } from "../config-fields/AbiParamsEditor";
import type {
  AbiDecodeConfig,
  AbiParameter,
  DataSchema,
  DataSchemaType,
} from "@6flow/shared/model/node";
import { useEditorStore } from "@/lib/editor-store";

interface Props {
  config: AbiDecodeConfig;
  onChange: (patch: Record<string, unknown>) => void;
  nodeId?: string;
}

function deriveOutputName(param: AbiParameter, outputNames: string[], index: number) {
  const configuredName = outputNames[index]?.trim();
  if (configuredName) {
    return configuredName;
  }

  const abiName = param.name.trim();
  if (abiName) {
    return abiName;
  }

  return `output${index}`;
}

function appendFieldPath(path: string, field: string) {
  return path ? `${path}.${field}` : field;
}

function appendArrayPath(path: string) {
  return path ? `${path}[]` : "[]";
}

function mapAbiTypeToSchemaType(abiType: string): DataSchemaType {
  if (abiType === "bool") {
    return "boolean";
  }
  if (
    abiType === "address" ||
    abiType === "string" ||
    abiType.startsWith("bytes")
  ) {
    return "string";
  }
  if (abiType.startsWith("uint") || abiType.startsWith("int")) {
    return "number";
  }
  return "unknown";
}

function abiParamToSchema(param: AbiParameter, path: string): DataSchema {
  if (param.type.endsWith("[]")) {
    const itemType = param.type.slice(0, -2);
    return {
      type: "array",
      path,
      itemSchema: abiParamToSchema(
        {
          ...param,
          type: itemType,
        },
        appendArrayPath(path),
      ),
    };
  }

  if (param.type === "tuple") {
    const fields = (param.components ?? []).map((component, index) => {
      const key = component.name.trim() || `field${index}`;
      const fieldPath = appendFieldPath(path, key);
      return {
        key,
        path: fieldPath,
        schema: abiParamToSchema(component, fieldPath),
      };
    });

    return {
      type: "object",
      path,
      fields,
    };
  }

  return {
    type: mapAbiTypeToSchemaType(param.type),
    path,
  };
}

function deriveAbiDecodeOutputSchema(config: AbiDecodeConfig): DataSchema {
  return {
    type: "object",
    path: "",
    fields: (config.abiParams ?? []).map((param, index) => {
      const key = deriveOutputName(param, config.outputNames ?? [], index);
      const path = appendFieldPath("", key);
      return {
        key,
        path,
        schema: abiParamToSchema(param, path),
      };
    }),
  };
}

export function AbiDecodeConfigRenderer({ config, onChange, nodeId }: Props) {
  const updateNodeEditor = useEditorStore((state) => state.updateNodeEditor);

  useEffect(() => {
    if (!nodeId) return;
    updateNodeEditor(nodeId, {
      outputSchema: deriveAbiDecodeOutputSchema(config),
      schemaSource: "derived",
    });
  }, [config, nodeId, updateNodeEditor]);

  return (
    <div className="space-y-3">
      <AbiParamsEditor
        label="ABI Parameters"
        value={config.abiParams}
        onChange={(abiParams) => onChange({ abiParams })}
      />

      <TagInput
        label="Output Names"
        value={config.outputNames}
        onChange={(outputNames) => onChange({ outputNames })}
        placeholder="Type name and press Enter..."
      />
    </div>
  );
}
