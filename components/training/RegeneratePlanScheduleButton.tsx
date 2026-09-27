"use client";

import { useState } from "react";
import { postRegenerateTrainingPlanSchedule } from "@/lib/training/regenerate-plan-schedule-client";

export type RegeneratePlanScheduleButtonProps = {
  planId: string;
  getToken: () => Promise<string>;
  weeklyMileageTarget: number;
  minWeeklyMiles: number;
  includedSecondaryAthleteRaceIds?: string[];
  onSuccess?: () => void | Promise<void>;
  onRegenerateStart?: () => void;
  onRegenerateEnd?: () => void;
  /** primary = orange fill; secondary = bordered (plan actions row) */
  variant?: "primary" | "secondary";
  className?: string;
  confirmMessage?: string;
};

const DEFAULT_CONFIRM =
  "Rebuild your schedule from your saved weekly target and training days? Workouts you have not completed yet will be replaced with the new plan.";

export function RegeneratePlanScheduleButton({
  planId,
  getToken,
  weeklyMileageTarget,
  minWeeklyMiles,
  includedSecondaryAthleteRaceIds,
  onSuccess,
  onRegenerateStart,
  onRegenerateEnd,
  variant = "secondary",
  className = "",
  confirmMessage = DEFAULT_CONFIRM,
}: RegeneratePlanScheduleButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (busy) return;
    if (!window.confirm(confirmMessage)) return;
    setBusy(true);
    setError(null);
    onRegenerateStart?.();
    try {
      const token = await getToken();
      const result = await postRegenerateTrainingPlanSchedule({
        token,
        trainingPlanId: planId,
        weeklyMileageTarget,
        minWeeklyMiles,
        includedSecondaryAthleteRaceIds,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regeneration failed");
    } finally {
      setBusy(false);
      onRegenerateEnd?.();
    }
  }

  const base =
    variant === "primary"
      ? "inline-flex items-center rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
      : "inline-flex items-center rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm font-semibold text-orange-900 hover:bg-orange-50 disabled:opacity-50";

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" disabled={busy} onClick={() => void handleClick()} className={`${base} ${className}`}>
        {busy ? "Regenerating…" : "Regenerate schedule"}
      </button>
      {error ? (
        <span className="text-xs text-red-700" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
