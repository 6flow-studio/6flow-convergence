"use client";

import {
  TextField,
  ExpressionTextField,
  SelectField,
  TextareaField,
  NumberField,
  BooleanField,
  KeyValueEditor,
  CollapsibleSection,
} from "../config-fields";
import type { HttpRequestConfig, HttpAuthConfig } from "@6flow/shared/model/node";

interface Props {
  config: HttpRequestConfig;
  onChange: (patch: Record<string, unknown>) => void;
}

const METHOD_OPTIONS = [
  { value: "GET", label: "GET" },
  { value: "POST", label: "POST" },
  { value: "PUT", label: "PUT" },
  { value: "DELETE", label: "DELETE" },
  { value: "PATCH", label: "PATCH" },
  { value: "HEAD", label: "HEAD" },
];

const AUTH_TYPE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "bearerToken", label: "Bearer Token" },
];

const CONTENT_TYPE_OPTIONS = [
  { value: "json", label: "JSON" },
  { value: "formUrlEncoded", label: "Form URL Encoded" },
  { value: "raw", label: "Raw" },
];

const RESPONSE_FORMAT_OPTIONS = [
  { value: "json", label: "JSON" },
  { value: "text", label: "Text" },
  { value: "binary", label: "Binary" },
];

function getAuthType(auth: HttpAuthConfig | undefined): string {
  return auth?.type ?? "none";
}

export function HttpRequestConfigRenderer({ config, onChange }: Props) {
  const authType = getAuthType(config.authentication);
  const auth = config.authentication as Record<string, unknown> | undefined;
  const showBody = ["POST", "PUT", "PATCH"].includes(config.method);

  function updateAuth(patch: Record<string, unknown>) {
    onChange({ authentication: { ...auth, ...patch } });
  }

  function changeAuthType(type: string) {
    switch (type) {
      case "none":
        onChange({ authentication: { type: "none" } });
        break;
      case "bearerToken":
        onChange({ authentication: { type: "bearerToken", tokenSecret: "" } });
        break;
    }
  }

  return (
    <div className="space-y-3">
      <SelectField
        label="Method"
        value={config.method}
        onChange={(method) => onChange({ method })}
        options={METHOD_OPTIONS}
      />

      <ExpressionTextField
        label="URL"
        description="Supports {{variable}} interpolation"
        value={config.url}
        onChange={(url) => onChange({ url })}
        placeholder="https://api.example.com/endpoint"
        mono
      />

      {/* Authentication */}
      <CollapsibleSection label="Authentication" defaultOpen={authType !== "none"}>
        <SelectField
          label="Type"
          value={authType}
          onChange={changeAuthType}
          options={AUTH_TYPE_OPTIONS}
        />
        {authType === "bearerToken" && (
          <TextField
            label="Token Secret"
            value={(auth?.tokenSecret as string) ?? ""}
            onChange={(v) => updateAuth({ tokenSecret: v })}
            placeholder="SECRET_NAME"
            mono
          />
        )}
      </CollapsibleSection>

      {/* Headers */}
      <CollapsibleSection label="Headers">
        <KeyValueEditor
          label="Request Headers"
          value={config.headers ?? {}}
          onChange={(headers) => onChange({ headers })}
          keyPlaceholder="Header name"
          valuePlaceholder="Header value"
        />
      </CollapsibleSection>

      {/* Query Parameters */}
      <CollapsibleSection label="Query Parameters">
        <KeyValueEditor
          label="Parameters"
          value={config.queryParameters ?? {}}
          onChange={(queryParameters) => onChange({ queryParameters })}
          keyPlaceholder="Param name"
          valuePlaceholder="Param value"
        />
      </CollapsibleSection>

      {/* Request Body (POST/PUT/PATCH only) */}
      {showBody && (
        <CollapsibleSection label="Request Body" defaultOpen>
          <SelectField
            label="Content Type"
            value={config.body?.contentType ?? "json"}
            onChange={(contentType) =>
              onChange({
                body: { contentType, data: config.body?.data ?? "" },
              })
            }
            options={CONTENT_TYPE_OPTIONS}
          />
          <TextareaField
            label="Data"
            value={config.body?.data ?? ""}
            onChange={(data) =>
              onChange({
                body: {
                  contentType: config.body?.contentType ?? "json",
                  data,
                },
              })
            }
            placeholder='{"key": "value"}'
            rows={5}
            mono
          />
        </CollapsibleSection>
      )}

      {/* Advanced */}
      <CollapsibleSection label="Advanced">
        <NumberField
          label="Timeout (ms)"
          value={config.timeout}
          onChange={(timeout) => onChange({ timeout })}
          min={0}
          max={10000}
          step={100}
        />
        <NumberField
          label="Cache Max Age (s)"
          value={config.cacheMaxAge}
          onChange={(cacheMaxAge) => onChange({ cacheMaxAge })}
          min={0}
          max={600}
        />
        <SelectField
          label="Response Format"
          value={config.responseFormat ?? "json"}
          onChange={(responseFormat) => onChange({ responseFormat })}
          options={RESPONSE_FORMAT_OPTIONS}
        />
        <BooleanField
          label="Follow Redirects"
          value={config.followRedirects ?? true}
          onChange={(followRedirects) => onChange({ followRedirects })}
        />
        <BooleanField
          label="Ignore SSL"
          description="For development/testing only"
          value={config.ignoreSSL ?? false}
          onChange={(ignoreSSL) => onChange({ ignoreSSL })}
        />
      </CollapsibleSection>
    </div>
  );
}
