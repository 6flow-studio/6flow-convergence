"use client";

import { useMemo } from "react";
import { SelectField, NumberField } from "../config-fields";
import type { CronTriggerConfig } from "@6flow/shared/model/node";

interface Props {
  config: CronTriggerConfig;
  onChange: (patch: Record<string, unknown>) => void;
}

type IntervalUnit =
  | "second"
  | "minute"
  | "hour"
  | "day"
  | "week"
  | "month";

const INTERVAL_OPTIONS: { value: IntervalUnit; label: string }[] = [
  { value: "second", label: "Every Second" },
  { value: "minute", label: "Every Minute" },
  { value: "hour", label: "Every Hour" },
  { value: "day", label: "Every Day" },
  { value: "week", label: "Every Week" },
  { value: "month", label: "Every Month" },
];

const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "America/New York" },
  { value: "America/Chicago", label: "America/Chicago" },
  { value: "America/Denver", label: "America/Denver" },
  { value: "America/Los_Angeles", label: "America/Los Angeles" },
  { value: "America/Sao_Paulo", label: "America/Sao Paulo" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Europe/Paris", label: "Europe/Paris" },
  { value: "Europe/Berlin", label: "Europe/Berlin" },
  { value: "Europe/Moscow", label: "Europe/Moscow" },
  { value: "Asia/Dubai", label: "Asia/Dubai" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata" },
  { value: "Asia/Bangkok", label: "Asia/Bangkok" },
  { value: "Asia/Shanghai", label: "Asia/Shanghai" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo" },
  { value: "Asia/Seoul", label: "Asia/Seoul" },
  { value: "Asia/Singapore", label: "Asia/Singapore" },
  { value: "Australia/Sydney", label: "Australia/Sydney" },
  { value: "Pacific/Auckland", label: "Pacific/Auckland" },
];

/** Parse a 6-field cron expression into { unit, interval }. */
function parseCron(cron: string): { unit: IntervalUnit; interval: number } {
  const parts = cron.trim().split(/\s+/);
  // 6-field: sec min hour dom month dow

  if (parts.length !== 6) return { unit: "minute", interval: 10 };

  const [sec, min, hour, dom, mon] = parts;

  // Every N seconds: */N * * * * *
  if (sec.startsWith("*/") && min === "*") {
    return { unit: "second", interval: parseInt(sec.slice(2)) || 1 };
  }
  // Every N minutes: 0 */N * * * *
  if (sec === "0" && min.startsWith("*/") && hour === "*") {
    return { unit: "minute", interval: parseInt(min.slice(2)) || 1 };
  }
  // Every N hours: 0 0 */N * * *
  if (sec === "0" && min === "0" && hour.startsWith("*/") && dom === "*") {
    return { unit: "hour", interval: parseInt(hour.slice(2)) || 1 };
  }
  // Every N days: 0 0 0 */N * *
  if (sec === "0" && min === "0" && hour === "0" && dom.startsWith("*/") && mon === "*") {
    return { unit: "day", interval: parseInt(dom.slice(2)) || 1 };
  }
  // Every N months: 0 0 0 1 */N *
  if (sec === "0" && min === "0" && hour === "0" && dom === "1" && mon.startsWith("*/")) {
    return { unit: "month", interval: parseInt(mon.slice(2)) || 1 };
  }
  // Weekly: 0 0 0 * * 0 (or */N not standard, but we detect dow=0)
  if (sec === "0" && min === "0" && hour === "0" && dom === "*" && mon === "*") {
    return { unit: "week", interval: 1 };
  }

  // Fallback
  return { unit: "minute", interval: 10 };
}

/** Build a 6-field cron expression from { unit, interval }. */
function toCron(unit: IntervalUnit, interval: number): string {
  const n = Math.max(1, Math.floor(interval));
  switch (unit) {
    case "second":
      return `*/${n} * * * * *`;
    case "minute":
      return `0 */${n} * * * *`;
    case "hour":
      return `0 0 */${n} * * *`;
    case "day":
      return `0 0 0 */${n} * *`;
    case "week":
      return `0 0 0 * * 0`;
    case "month":
      return `0 0 0 1 */${n} *`;
  }
}

export function CronTriggerConfigRenderer({ config, onChange }: Props) {
  const parsed = useMemo(() => parseCron(config.schedule), [config.schedule]);

  const handleUnitChange = (unit: string) => {
    const schedule = toCron(unit as IntervalUnit, parsed.interval);
    onChange({ schedule });
  };

  const handleIntervalChange = (interval: number) => {
    const schedule = toCron(parsed.unit, interval);
    onChange({ schedule });
  };

  const showInterval = parsed.unit !== "week";

  return (
    <div className="space-y-3">
      <SelectField
        label="Run"
        value={parsed.unit}
        onChange={handleUnitChange}
        options={INTERVAL_OPTIONS}
      />
      {showInterval && (
        <NumberField
          label={`Every${parsed.unit === "second" ? "" : ""}`}
          description={`Run every N ${parsed.unit}s (min 30s interval)`}
          value={parsed.interval}
          onChange={handleIntervalChange}
          min={1}
          step={1}
          placeholder="1"
        />
      )}
      <div className="text-[11px] font-mono text-zinc-500 px-1">
        {config.schedule}
      </div>
      <SelectField
        label="Timezone"
        value={config.timezone ?? "UTC"}
        onChange={(timezone) => onChange({ timezone })}
        options={TIMEZONE_OPTIONS}
      />
    </div>
  );
}
