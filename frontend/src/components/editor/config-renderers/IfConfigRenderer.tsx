"use client";

import { ConditionBuilder } from "../config-fields";
import type { IfConfig, Condition } from "@6flow/shared/model/node";

interface Props {
  config: IfConfig;
  onChange: (patch: Record<string, unknown>) => void;
}

export function IfConfigRenderer({ config, onChange }: Props) {
  function handleChange(conditions: Condition[], combineWith: "and" | "or") {
    onChange({ conditions, combineWith });
  }

  return (
    <div className="space-y-3">
      <span className="text-[11px] text-zinc-500 block">
        Route items to &quot;true&quot; or &quot;false&quot; output based on conditions.
      </span>
      <ConditionBuilder
        conditions={config.conditions}
        combineWith={config.combineWith}
        onChange={handleChange}
      />
    </div>
  );
}
