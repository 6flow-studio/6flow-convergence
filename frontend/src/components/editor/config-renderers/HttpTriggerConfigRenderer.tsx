"use client";

import {
  TextField,
  SelectField,
  NumberField,
  TagInput,
  KeyValueEditor,
  CollapsibleSection,
} from "../config-fields";
import type { HttpTriggerConfig, WebhookAuth } from "@6flow/shared/model/node";

interface Props {
  config: HttpTriggerConfig;
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
  { value: "evmSignature", label: "EVM Signature" },
  { value: "headerAuth", label: "Header Auth" },
  { value: "basicAuth", label: "Basic Auth" },
];

const RESPONSE_MODE_OPTIONS = [
  { value: "immediate", label: "Immediate" },
  { value: "lastNode", label: "Last Node" },
  { value: "respondNode", label: "Respond Node" },
];

function getAuthType(auth: WebhookAuth | undefined): string {
  return auth?.type ?? "none";
}

export function HttpTriggerConfigRenderer({ config, onChange }: Props) {
  const authType = getAuthType(config.authentication);
  const auth = config.authentication as Record<string, unknown> | undefined;

  function changeAuthType(type: string) {
    switch (type) {
      case "none":
        onChange({ authentication: { type: "none" } });
        break;
      case "evmSignature":
        onChange({
          authentication: { type: "evmSignature", authorizedAddresses: [] },
        });
        break;
      case "headerAuth":
        onChange({
          authentication: {
            type: "headerAuth",
            headerName: "",
            headerValueSecret: "",
          },
        });
        break;
      case "basicAuth":
        onChange({
          authentication: {
            type: "basicAuth",
            usernameSecret: "",
            passwordSecret: "",
          },
        });
        break;
    }
  }

  function updateAuth(patch: Record<string, unknown>) {
    onChange({ authentication: { ...auth, ...patch } });
  }

  return (
    <div className="space-y-3">
      <SelectField
        label="HTTP Method"
        value={config.httpMethod}
        onChange={(httpMethod) => onChange({ httpMethod })}
        options={METHOD_OPTIONS}
      />

      <TextField
        label="Path"
        description="Custom path suffix (optional)"
        value={config.path ?? ""}
        onChange={(path) => onChange({ path: path || undefined })}
        placeholder="/my-webhook"
        mono
      />

      {/* Authentication */}
      <CollapsibleSection
        label="Authentication"
        defaultOpen={authType !== "none"}
      >
        <SelectField
          label="Type"
          value={authType}
          onChange={changeAuthType}
          options={AUTH_TYPE_OPTIONS}
        />
        {authType === "evmSignature" && (
          <TagInput
            label="Authorized Addresses"
            value={(auth?.authorizedAddresses as string[]) ?? []}
            onChange={(v) => updateAuth({ authorizedAddresses: v })}
            placeholder="0x..."
          />
        )}
        {authType === "headerAuth" && (
          <>
            <TextField
              label="Header Name"
              value={(auth?.headerName as string) ?? ""}
              onChange={(v) => updateAuth({ headerName: v })}
              placeholder="X-Webhook-Secret"
            />
            <TextField
              label="Header Value Secret"
              value={(auth?.headerValueSecret as string) ?? ""}
              onChange={(v) => updateAuth({ headerValueSecret: v })}
              placeholder="WEBHOOK_SECRET"
              mono
            />
          </>
        )}
        {authType === "basicAuth" && (
          <>
            <TextField
              label="Username Secret"
              value={(auth?.usernameSecret as string) ?? ""}
              onChange={(v) => updateAuth({ usernameSecret: v })}
              placeholder="USERNAME_SECRET"
              mono
            />
            <TextField
              label="Password Secret"
              value={(auth?.passwordSecret as string) ?? ""}
              onChange={(v) => updateAuth({ passwordSecret: v })}
              placeholder="PASSWORD_SECRET"
              mono
            />
          </>
        )}
      </CollapsibleSection>

      {/* Response */}
      <CollapsibleSection label="Response">
        <SelectField
          label="Response Mode"
          value={config.responseMode}
          onChange={(responseMode) => onChange({ responseMode })}
          options={RESPONSE_MODE_OPTIONS}
        />
        <NumberField
          label="Status Code"
          value={config.responseCode ?? 200}
          onChange={(responseCode) => onChange({ responseCode })}
          min={100}
          max={599}
        />
        <KeyValueEditor
          label="Response Headers"
          value={config.responseHeaders ?? {}}
          onChange={(responseHeaders) => onChange({ responseHeaders })}
        />
      </CollapsibleSection>

      {/* CORS */}
      <CollapsibleSection label="CORS">
        <TagInput
          label="Allowed Origins"
          value={config.allowedOrigins ?? []}
          onChange={(allowedOrigins) => onChange({ allowedOrigins })}
          placeholder="https://example.com"
        />
      </CollapsibleSection>
    </div>
  );
}
