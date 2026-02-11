"use client";

import { TextareaField } from "../config-fields";
import type { ErrorConfig } from "@6flow/shared/model/node";

interface Props {
  config: ErrorConfig;
  onChange: (patch: Record<string, unknown>) => void;
}

export function ErrorConfigRenderer({ config, onChange }: Props) {
  return (
    <div className="space-y-3">
      <TextareaField
        label="Error Message"
        description="Supports {{variable}} interpolation"
        value={config.errorMessage}
        onChange={(errorMessage) => onChange({ errorMessage })}
        placeholder="Failed: {{reason}}"
        rows={3}
        mono
      />
    </div>
  );
}
