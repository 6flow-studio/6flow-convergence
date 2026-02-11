"use client";

import { TextField, SelectField } from "../config-fields";
import type { CronTriggerConfig } from "@6flow/shared/model/node";

interface Props {
  config: CronTriggerConfig;
  onChange: (patch: Record<string, unknown>) => void;
}

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

export function CronTriggerConfigRenderer({ config, onChange }: Props) {
  return (
    <div className="space-y-3">
      <TextField
        label="Schedule"
        description="6-field cron expression"
        value={config.schedule}
        onChange={(schedule) => onChange({ schedule })}
        placeholder="0 */10 * * * *"
        mono
      />
      <SelectField
        label="Timezone"
        value={config.timezone ?? "UTC"}
        onChange={(timezone) => onChange({ timezone })}
        options={TIMEZONE_OPTIONS}
      />
    </div>
  );
}
