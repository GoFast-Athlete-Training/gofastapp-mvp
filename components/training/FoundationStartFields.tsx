"use client";

import { resolveAthleteStart } from "@/lib/training/foundation-progression";

function positiveOrNull(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function foundationMilesToSave(input: {
  weeklyMiles: string;
  longRunMiles: string;
  returningFromInjury: boolean;
}) {
  return resolveAthleteStart({
    currentWeeklyMileage: positiveOrNull(input.weeklyMiles),
    longRunCapabilityMiles: positiveOrNull(input.longRunMiles),
    returningFromInjury: input.returningFromInjury,
  });
}

export function FoundationStartFields({
  weeklyMiles,
  onWeeklyMiles,
  longRunMiles,
  onLongRunMiles,
  returningFromInjury = false,
  onReturningFromInjury,
  showInjuryCheckbox = true,
  weeklyCaption,
}: {
  weeklyMiles: string;
  onWeeklyMiles: (value: string) => void;
  longRunMiles: string;
  onLongRunMiles: (value: string) => void;
  returningFromInjury?: boolean;
  onReturningFromInjury?: (value: boolean) => void;
  showInjuryCheckbox?: boolean;
  weeklyCaption?: string;
}) {
  const injury = showInjuryCheckbox ? returningFromInjury : false;
  const start = foundationMilesToSave({
    weeklyMiles,
    longRunMiles,
    returningFromInjury: injury,
  });
  const preview = start.missingData
    ? "No current weekly miles or longest run yet. The peak block will start from the preset entry."
    : `Starting point: ${start.weeklyMiles ?? "—"} mi/week and a ${start.longRunMiles ?? "—"} mi long run.${
        start.derived
          ? " One number was estimated from the other (long run is about 30% of the week)."
          : ""
      }${
        start.returningFromInjury ? " Reduced 25% for a return from a break or injury." : ""
      }`;

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          How many miles per week are you running right now?
        </label>
        <input
          type="number"
          min={0}
          step={1}
          className="w-full max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          value={weeklyMiles}
          onChange={(e) => onWeeklyMiles(e.target.value)}
        />
        <p className="mt-1.5 text-xs text-gray-600">
          {weeklyCaption ?? "This is your baseline today. Target weekly mileage comes later."}
        </p>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-700">
          Longest recent run (miles)
        </label>
        <input
          type="number"
          min={0}
          step={0.1}
          className="w-full max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          value={longRunMiles}
          onChange={(e) => onLongRunMiles(e.target.value)}
        />
      </div>
      {showInjuryCheckbox && onReturningFromInjury ? (
        <label className="flex items-start gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            className="mt-1"
            checked={returningFromInjury}
            onChange={(e) => onReturningFromInjury(e.target.checked)}
          />
          <span>I&apos;m coming back from a break or injury</span>
        </label>
      ) : null}
      <p className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800">{preview}</p>
    </div>
  );
}
