"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cruiseOverlayAndRegenerate, dismissAddedRacePrompt } from "@/lib/training/added-race-plan-regen";

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
  const router = useRouter();
  const [busy, setBusy] = useState<"cruise" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const terminalLabel = terminalRaceName?.trim() || "your goal race";
  const isRegenerating = busy != null;

  function goToAddPlan() {
    const qs = new URLSearchParams({
      athleteRaceId: addedRaceAthleteRaceId,
      retireActivePlan: "park",
    });
    router.push(`/training-setup?${qs.toString()}`);
    onSuccess?.();
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

  return (
    <div
      className={`rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 ${className}`}
    >
      <p className="font-medium text-amber-950">
        You added {addedRaceName}.
        {weekNumber != null ? ` It falls in your current plan (week ${weekNumber}).` : " It falls in your current plan."}
      </p>
      <p className="mt-2 text-amber-900/90">
        Add a new plan for {addedRaceName}, or keep training for {terminalLabel} and we&apos;ll
        overlay this race on your schedule.
      </p>

      {isRegenerating ? (
        <p className="mt-3 text-xs font-medium text-amber-900">Regenerating…</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={goToAddPlan}
            disabled={isRegenerating}
            className="inline-flex items-center rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
          >
            Add a plan for {addedRaceName}
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
