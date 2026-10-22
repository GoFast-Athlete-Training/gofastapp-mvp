"use client";

import { DEFAULT_PACE_OPTION, PACE_OPTIONS } from "@/lib/runTypes";
import type { RunInstanceWizardValues } from "./shared";

type Props = {
  values: RunInstanceWizardValues;
  onChange: (partial: Partial<RunInstanceWizardValues>) => void;
};

/** Athlete host-a-run: miles + pace only — no club AI/manual workout builder. */
export default function AthleteHostedDistancePaceStep({ values, onChange }: Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Optional for social runs — leave blank if you only care about meetup and time. These show on
        your invite when set.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-900">Distance (miles)</label>
          <input
            type="text"
            inputMode="decimal"
            value={values.totalMiles}
            onChange={(e) => onChange({ totalMiles: e.target.value })}
            placeholder="e.g. 4.7"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-900">Pace</label>
          <select
            value={values.pace || DEFAULT_PACE_OPTION}
            onChange={(e) => onChange({ pace: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Select pace…</option>
            {PACE_OPTIONS.map((pace) => (
              <option key={pace} value={pace}>
                {pace}
              </option>
            ))}
            {values.pace &&
              !PACE_OPTIONS.includes(values.pace as (typeof PACE_OPTIONS)[number]) && (
                <option value={values.pace}>{values.pace}</option>
              )}
          </select>
        </div>
      </div>
    </div>
  );
}
