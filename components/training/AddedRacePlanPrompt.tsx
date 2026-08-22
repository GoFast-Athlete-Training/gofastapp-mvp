"use client";

import { useState } from "react";
import {
  cruiseOverlayAndRegenerate,
  dismissAddedRacePrompt,
  pointPlanHereAndRegenerate,
} from "@/lib/training/added-race-plan-regen";

export type AddedRacePlanPromptProps = {
  planId: string;
  getToken: () => Promise<string>;
  addedRaceAthleteRaceId: string;
  addedRaceName: string;
  weekNumber?: number | null;
  terminalRaceName?: string | null;
  weeklyMileageTarget: number;
  minWeeklyMiles?: number;
  snappedAthleteRaceIds: string[];
  pendingAthleteRaceIds: string[];
  onSuccess?: () => void;
  onDismiss?: () => void;
  className?: string;
};

export function AddedRacePlanPrompt({
  planId,
  getToken,
  addedRaceAthleteRaceId,
  addedRaceName,
  weekNumber,
  terminalRaceName,
  weeklyMileageTarget,
  minWeeklyMiles,
  snappedAthleteRaceIds,
  pendingAthleteRaceIds,
  onSuccess,
  onDismiss,
  className = "",
}: AddedRacePlanPromptProps) {
  const [busy, setBusy] = useState<"point" | "cruise" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handlePointHere() {
    setBusy("point");
    setError(null);
    try {
      const token = await getToken();
      const result = await pointPlanHereAndRegenerate({
        planId,
        token,
        newAthleteRaceId: addedRaceAthleteRaceId,
        weeklyMileageTarget,
        minWeeklyMiles,
        snappedAthleteRaceIds,
        pendingAthleteRaceIds,
      });
      if (!result.ok) {
        setError(result.error ?? "Could not update plan");
        return;
      }
      setSuccess(true);
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update plan");
    } finally {
      setBusy(null);
    }
  }

  async function handleCruise() {
    setBusy("cruise");
    setError(null);
    try {
      const token = await getToken();
      const result = await cruiseOverlayAndRegenerate({
        planId,
        token,
        weeklyMileageTarget,
        minWeeklyMiles,
        snappedAthleteRaceIds,
        pendingAthleteRaceIds,
      });
      if (!result.ok) {
        setError(result.error ?? "Could not regenerate plan");
        return;
      }
      setSuccess(true);
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not regenerate plan");
    } finally {
      setBusy(null);
    }
  }

  function handleDismiss() {
    dismissAddedRacePrompt(addedRaceAthleteRaceId);
    onDismiss?.();
  }

  if (success) {
    return (
      <div
        className={`rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 ${className}`}
        role="status"
      >
        <p className="font-medium">Schedule regenerated with your updated races.</p>
      </div>
    );
  }

  const terminalLabel = terminalRaceName?.trim() || "your goal race";
  const isRegenerating = busy != null;

  return (
    <div
      className={`rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 ${className}`}
    >
      <p className="font-medium text-amber-950">
        You added {addedRaceName}.
        {weekNumber != null ? ` It falls in your current plan (week ${weekNumber}).` : " It falls in your current plan."}
      </p>
      <p className="mt-2 text-amber-900/90">
        Point your plan at this race for a shorter build, or keep training for {terminalLabel} and
        we&apos;ll overlay this race on your schedule.
      </p>

      {isRegenerating ? (
        <p className="mt-3 text-xs font-medium text-amber-900">Regenerating…</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handlePointHere()}
            disabled={isRegenerating}
            className="inline-flex items-center rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
          >
            Point plan here
          </button>
          <button
            type="button"
            onClick={() => void handleCruise()}
            disabled={isRegenerating}
            className="inline-flex items-center rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100/80 disabled:opacity-60"
          >
            Keep training for {terminalLabel}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={isRegenerating}
            className="inline-flex items-center rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100/80 disabled:opacity-60"
          >
            Not now
          </button>
        </div>
      )}

      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
