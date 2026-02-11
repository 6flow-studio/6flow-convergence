"use client";

import { TextField } from "../config-fields";
import type { CheckKycConfig } from "@6flow/shared/model/node";

interface Props {
  config: CheckKycConfig;
  onChange: (patch: Record<string, unknown>) => void;
}

export function CheckKycConfigRenderer({ config, onChange }: Props) {
  return (
    <div className="space-y-3">
      <TextField
        label="Provider URL"
        value={config.providerUrl}
        onChange={(providerUrl) => onChange({ providerUrl })}
        placeholder="https://kyc-api.example.com/verify"
        mono
      />
      <TextField
        label="API Key Secret"
        description="Secret name for API key"
        value={config.apiKeySecretName}
        onChange={(apiKeySecretName) => onChange({ apiKeySecretName })}
        placeholder="KYC_API_KEY"
        mono
      />
      <TextField
        label="Wallet Address Source"
        description="{{nodeId.field}} reference"
        value={config.walletAddressSource}
        onChange={(walletAddressSource) => onChange({ walletAddressSource })}
        placeholder="{{parse.wallet}}"
        mono
      />
    </div>
  );
}
