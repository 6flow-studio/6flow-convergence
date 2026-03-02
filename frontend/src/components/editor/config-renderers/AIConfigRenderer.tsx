"use client";

import { useEffect } from "react";
import {
  SelectField,
  TextareaField,
  NumberField,
  CollapsibleSection,
} from "../config-fields";
import type { AINodeConfig } from "@6flow/shared/model/node";
import { AI_PROVIDERS, getAIOutputDataSchema } from "@6flow/shared/listAIProviders";
import { useEditorStore } from "@/lib/editor-store";

interface Props {
  config: AINodeConfig;
  onChange: (patch: Record<string, unknown>) => void;
  secretNames?: string[];
  nodeId?: string;
}

const MODEL_OPTIONS = AI_PROVIDERS.map((p) => ({
  value: p.value,
  label: `${p.label} (${p.provider})`,
}));

const RESPONSE_FORMAT_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "json", label: "JSON" },
];

function getModelPreset(model: string) {
  return AI_PROVIDERS.find((p) => p.value === model);
}

export function AIConfigRenderer({ config, onChange, secretNames = [], nodeId }: Props) {
  const selectedPreset = getModelPreset(config.model);
  const updateNodeEditor = useEditorStore((s) => s.updateNodeEditor);

  useEffect(() => {
    const targetPreset = selectedPreset ?? AI_PROVIDERS[0];
    if (!targetPreset) return;

    const normalizedProvider = targetPreset.provider.toLowerCase();
    const isNormalized =
      config.model === targetPreset.value &&
      config.provider === normalizedProvider &&
      config.baseUrl === targetPreset.baseUrl;

    if (isNormalized) return;

    onChange({
      provider: normalizedProvider,
      model: targetPreset.value,
      baseUrl: targetPreset.baseUrl,
    });
  }, [config.baseUrl, config.model, config.provider, onChange, selectedPreset]);

  // Set declared output schema based on the selected provider
  useEffect(() => {
    if (!nodeId) return;
    const preset = selectedPreset ?? AI_PROVIDERS[0];
    if (!preset) return;

    const providerName = preset.provider as "OpenAI" | "Anthropic" | "Google";
    const schema = getAIOutputDataSchema(providerName);
    updateNodeEditor(nodeId, { outputSchema: schema, schemaSource: "declared" });
  }, [nodeId, selectedPreset, updateNodeEditor]);

  const handleModelSelect = (value: string) => {
    const preset = AI_PROVIDERS.find((p) => p.value === value);
    if (preset) {
      onChange({
        provider: preset.provider.toLowerCase(),
        model: preset.value,
        baseUrl: preset.baseUrl,
      });
    }
  };

  return (
    <div className="space-y-3">
      <SelectField
        label="Model"
        value={selectedPreset?.value ?? AI_PROVIDERS[0]?.value ?? ""}
        onChange={handleModelSelect}
        options={MODEL_OPTIONS}
      />

      <SelectField
        label="API Key Secret"
        description="Select a secret defined in Workflow Settings"
        value={config.apiKeySecret}
        onChange={(apiKeySecret) => onChange({ apiKeySecret })}
        options={secretNames.map((name) => ({ value: name, label: name }))}
        placeholder={secretNames.length === 0 ? "No secrets defined" : "Select a secret"}
      />

      <TextareaField
        label="System Prompt"
        value={config.systemPrompt}
        onChange={(systemPrompt) => onChange({ systemPrompt })}
        rows={3}
        placeholder="You are a helpful assistant..."
      />

      <TextareaField
        label="User Prompt"
        description="Supports {{variable}} interpolation"
        value={config.userPrompt}
        onChange={(userPrompt) => onChange({ userPrompt })}
        rows={5}
        placeholder="Process this data: {{input}}"
      />

      {/* Model Parameters */}
      <CollapsibleSection label="Model Parameters">
        <NumberField
          label="Temperature"
          value={config.temperature ?? 0.7}
          onChange={(temperature) => onChange({ temperature })}
          min={0}
          max={2}
          step={0.1}
        />
        <NumberField
          label="Max Tokens"
          value={config.maxTokens}
          onChange={(maxTokens) => onChange({ maxTokens })}
          min={1}
          max={128000}
          step={100}
        />
        <SelectField
          label="Response Format"
          value={config.responseFormat ?? "text"}
          onChange={(responseFormat) => onChange({ responseFormat })}
          options={RESPONSE_FORMAT_OPTIONS}
        />
      </CollapsibleSection>

      {/* Advanced */}
      <CollapsibleSection label="Advanced">
        <NumberField
          label="Timeout (ms)"
          value={config.timeout}
          onChange={(timeout) => onChange({ timeout })}
          min={0}
          max={60000}
          step={1000}
        />
        <NumberField
          label="Max Retries"
          value={config.maxRetries ?? 3}
          onChange={(maxRetries) => onChange({ maxRetries })}
          min={0}
          max={10}
        />
      </CollapsibleSection>
    </div>
  );
}
