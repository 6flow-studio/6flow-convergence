"use client";

import {
  TextField,
  SelectField,
  TextareaField,
  NumberField,
  CollapsibleSection,
} from "../config-fields";
import type { AINodeConfig } from "@6flow/shared/model/node";
import { AI_PROVIDERS } from "@6flow/shared/listAIProviders";

interface Props {
  config: AINodeConfig;
  onChange: (patch: Record<string, unknown>) => void;
}

const CUSTOM_VALUE = "__custom__";

const MODEL_OPTIONS = [
  ...AI_PROVIDERS.map((p) => ({
    value: p.value,
    label: `${p.label} (${p.provider})`,
  })),
  { value: CUSTOM_VALUE, label: "Custom" },
];

const RESPONSE_FORMAT_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "json", label: "JSON" },
];

function isCustomModel(model: string) {
  return !AI_PROVIDERS.some((p) => p.value === model);
}

export function AIConfigRenderer({ config, onChange }: Props) {
  const isCustom = isCustomModel(config.model);
  const selectValue = isCustom ? CUSTOM_VALUE : config.model;

  const handleModelSelect = (value: string) => {
    if (value === CUSTOM_VALUE) {
      onChange({ provider: "custom", model: "", baseUrl: "" });
      return;
    }
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
        value={selectValue}
        onChange={handleModelSelect}
        options={MODEL_OPTIONS}
      />

      {isCustom && (
        <>
          <TextField
            label="Provider"
            value={config.provider}
            onChange={(provider) => onChange({ provider })}
            placeholder="openai"
          />
          <TextField
            label="Model ID"
            value={config.model}
            onChange={(model) => onChange({ model })}
            placeholder="gpt-4"
            mono
          />
          <TextField
            label="Base URL"
            value={config.baseUrl}
            onChange={(baseUrl) => onChange({ baseUrl })}
            placeholder="https://api.openai.com/v1/chat/completions"
            mono
          />
        </>
      )}

      <TextField
        label="API Key Secret"
        description="References a secret name"
        value={config.apiKeySecret}
        onChange={(apiKeySecret) => onChange({ apiKeySecret })}
        placeholder="OPENAI_API_KEY"
        mono
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
