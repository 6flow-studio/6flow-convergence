"use client";

import {
  TextField,
  SelectField,
  TextareaField,
  NumberField,
  CollapsibleSection,
} from "../config-fields";
import type { AINodeConfig } from "@6flow/shared/model/node";

interface Props {
  config: AINodeConfig;
  onChange: (patch: Record<string, unknown>) => void;
}

const PROVIDER_OPTIONS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "custom", label: "Custom" },
];

const RESPONSE_FORMAT_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "json", label: "JSON" },
];

export function AIConfigRenderer({ config, onChange }: Props) {
  return (
    <div className="space-y-3">
      <SelectField
        label="Provider"
        value={config.provider}
        onChange={(provider) => onChange({ provider })}
        options={PROVIDER_OPTIONS}
      />

      <TextField
        label="Base URL"
        value={config.baseUrl}
        onChange={(baseUrl) => onChange({ baseUrl })}
        placeholder="https://api.openai.com/v1"
        mono
      />

      <TextField
        label="Model"
        value={config.model}
        onChange={(model) => onChange({ model })}
        placeholder="gpt-4"
      />

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
