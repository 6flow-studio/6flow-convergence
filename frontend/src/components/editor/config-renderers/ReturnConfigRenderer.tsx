"use client";

import { TextareaField } from "../config-fields";
import type { ReturnConfig } from "@6flow/shared/model/node";

interface Props {
  config: ReturnConfig;
  onChange: (patch: Record<string, unknown>) => void;
}

export function ReturnConfigRenderer({ config, onChange }: Props) {
  return (
    <div className="space-y-3">
      <TextareaField
        label="Return Expression"
        value={config.returnExpression}
        onChange={(returnExpression) => onChange({ returnExpression })}
        placeholder="result"
        rows={2}
        mono
      />
    </div>
  );
}
