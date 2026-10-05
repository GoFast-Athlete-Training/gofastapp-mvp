"use client";

import {
  emptyAffiliationDraft,
  type RunAffiliationDraft,
  RUN_MANAGE_TYPE_LABELS,
  RUN_MANAGE_TYPE_HINTS,
} from "@/components/runmanage/RunManageRunAffiliations";
import {
  RUN_MANAGE_STAFF_CREATE_RUN_TYPES,
  type RunManageStaffCreateRunType,
} from "@/lib/runmanage/create-run-scope";

type Props = {
  draft: RunAffiliationDraft;
  onDraftChange: (next: RunAffiliationDraft) => void;
  imprintedCompanyRaceId?: string | null;
  imprintedRaceLabel?: string | null;
};

export default function RunManageCreateRunScope({
  draft,
  onDraftChange,
  imprintedCompanyRaceId,
  imprintedRaceLabel,
}: Props) {
  const setRunType = (next: RunManageStaffCreateRunType) => {
    onDraftChange(emptyAffiliationDraft(next));
  };

  const runTypeValue = RUN_MANAGE_STAFF_CREATE_RUN_TYPES.includes(
    draft.cityRunType as RunManageStaffCreateRunType
  )
    ? draft.cityRunType
    : "CLUB";

  return (
    <div className="max-w-3xl space-y-2">
      <div>
        <label className="block text-sm font-semibold text-gray-900" htmlFor="run-type-select">
          Run type
        </label>
        <select
          id="run-type-select"
          value={runTypeValue}
          onChange={(e) => setRunType(e.target.value as RunManageStaffCreateRunType)}
          className="mt-1 w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          {RUN_MANAGE_STAFF_CREATE_RUN_TYPES.map((t) => (
            <option key={t} value={t}>
              {RUN_MANAGE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-600">
          {RUN_MANAGE_TYPE_HINTS[runTypeValue as RunManageStaffCreateRunType]}
        </p>
      </div>
      {runTypeValue === "RACE_SHAKEOUT" && (imprintedCompanyRaceId || imprintedRaceLabel) ? (
        <p className="text-xs text-gray-500">
          Shakeout for {imprintedRaceLabel?.trim() || "this race"}.
        </p>
      ) : null}
    </div>
  );
}
