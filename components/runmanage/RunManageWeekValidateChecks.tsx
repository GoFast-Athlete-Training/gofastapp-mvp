"use client";

import { Loader2 } from "lucide-react";
import runmanageApi from "@/lib/runmanage/api-client";

export type WeekValidateFlags = {
  dateValidate: boolean;
  timeValidate: boolean;
  meetupValidate: boolean;
};

type Props = {
  runId: string;
  flags: WeekValidateFlags;
  compact?: boolean;
  onUpdated?: (next: WeekValidateFlags) => void;
};

export function validationReady(flags: WeekValidateFlags): boolean {
  return flags.dateValidate && flags.timeValidate && flags.meetupValidate;
}

export default function RunManageWeekValidateChecks({
  runId,
  flags,
  compact = false,
  onUpdated,
}: Props) {
  const patch = async (partial: Partial<WeekValidateFlags>) => {
    const res = await runmanageApi.patch(`/api/runmanage/runs/${encodeURIComponent(runId)}/week-validate`, partial);
    if (res.data?.success && res.data.run) {
      onUpdated?.({
        dateValidate: Boolean(res.data.run.dateValidate),
        timeValidate: Boolean(res.data.run.timeValidate),
        meetupValidate: Boolean(res.data.run.meetupValidate),
      });
    }
  };

  const itemClass = compact
    ? "inline-flex items-center gap-1 text-xs text-gray-700"
    : "flex items-center gap-2 text-sm text-gray-800";

  return (
    <div className={compact ? "flex flex-wrap gap-2" : "space-y-2"}>
      <label className={itemClass}>
        <input
          type="checkbox"
          checked={flags.dateValidate}
          onChange={(e) => void patch({ dateValidate: e.target.checked })}
        />
        Date
      </label>
      <label className={itemClass}>
        <input
          type="checkbox"
          checked={flags.timeValidate}
          onChange={(e) => void patch({ timeValidate: e.target.checked })}
        />
        Time
      </label>
      <label className={itemClass}>
        <input
          type="checkbox"
          checked={flags.meetupValidate}
          onChange={(e) => void patch({ meetupValidate: e.target.checked })}
        />
        Meet-up
      </label>
    </div>
  );
}

export function RunManageWeekValidateChecksSaving() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
      <Loader2 className="h-3 w-3 animate-spin" />
      Saving…
    </span>
  );
}
