"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";
import { LongRunTrajectoryCard } from "@/components/training/LongRunTrajectoryCard";
import {
  computeLongRunTrajectoryPreview,
  peakBlockWeekRange,
  trajectoryRowsFromGenerated,
} from "@/lib/training/long-run-trajectory-preview";
import type { LongRunFitnessPhase } from "@/lib/training/long-run-cup-setter";
import type { RunTypePosition } from "@/lib/training/run-type-config-shared";
import { LONG_RUN_BLOCK_WEEKS } from "@/lib/training/long-run-block-weeks";

export type PlanLongRunTrajectorySectionProps = {
  planId: string;
  getToken: () => Promise<string>;
  totalWeeks: number;
  planStartDate: string;
  peakLongRunPoolMiles: number | null;
  blueprintPeakLongRunPoolMiles: number;
  fitnessPhase?: LongRunFitnessPhase;
  longRunPositions?: RunTypePosition[];
  currentWeek?: number | null;
  hasSchedule: boolean;
  editable?: boolean;
  showRegenerate?: boolean;
  weeklyMileageTarget: number;
  presetMinWeeklyMiles: number;
  onRegenerated?: () => void | Promise<void>;
  onDraftPeakChange?: (peak: number) => void;
};

function resolveEffectivePeak(
  planPeak: number | null,
  blueprintPeak: number
): number {
  if (planPeak != null && Number.isFinite(planPeak) && planPeak > 0) {
    return Math.round(planPeak * 10) / 10;
  }
  return Math.round(blueprintPeak * 10) / 10;
}

export function PlanLongRunTrajectorySection({
  planId,
  getToken,
  totalWeeks,
  planStartDate,
  peakLongRunPoolMiles,
  blueprintPeakLongRunPoolMiles,
  fitnessPhase = "BASE",
  longRunPositions = [],
  currentWeek,
  hasSchedule,
  editable = true,
  showRegenerate = true,
  weeklyMileageTarget,
  presetMinWeeklyMiles,
  onRegenerated,
  onDraftPeakChange,
}: PlanLongRunTrajectorySectionProps) {
  const savedPeak = resolveEffectivePeak(
    peakLongRunPoolMiles,
    blueprintPeakLongRunPoolMiles
  );
  const [draftPeak, setDraftPeak] = useState(savedPeak);
  const [generatedRows, setGeneratedRows] = useState<
    { weekNumber: number; miles: number }[] | null
  >(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);

  useEffect(() => {
    setDraftPeak(savedPeak);
  }, [savedPeak]);

  useEffect(() => {
    onDraftPeakChange?.(draftPeak);
  }, [draftPeak, onDraftPeakChange]);

  const planStart = useMemo(() => new Date(planStartDate), [planStartDate]);

  const loadScheduleSummary = useCallback(async () => {
    if (!hasSchedule) {
      setGeneratedRows(null);
      return;
    }
    setLoadingSummary(true);
    try {
      const token = await getToken();
      const res = await fetch(
        `/api/training/plan/schedule-summary?planId=${encodeURIComponent(planId)}`,
        { headers: athleteBearerFetchHeaders(token) }
      );
      const data = (await res.json()) as {
        error?: string;
        longRunByWeek?: { weekNumber: number; miles: number }[];
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not load long-run summary");
      }
      setGeneratedRows(Array.isArray(data.longRunByWeek) ? data.longRunByWeek : []);
    } catch (e) {
      setSectionError(e instanceof Error ? e.message : "Could not load long-run summary");
      setGeneratedRows(null);
    } finally {
      setLoadingSummary(false);
    }
  }, [getToken, hasSchedule, planId]);

  useEffect(() => {
    void loadScheduleSummary();
  }, [loadScheduleSummary]);

  const preview = useMemo(
    () =>
      computeLongRunTrajectoryPreview({
        totalWeeks,
        peakLongRunPoolMiles: draftPeak,
        fitnessPhase,
        longRunPositions,
        planStartDate: planStart,
      }),
    [draftPeak, fitnessPhase, longRunPositions, planStart, totalWeeks]
  );

  const peakDirty = Math.abs(draftPeak - savedPeak) > 0.05;
  const useGenerated = hasSchedule && generatedRows != null && generatedRows.length > 0 && !peakDirty;

  const rows = useGenerated
    ? trajectoryRowsFromGenerated({
        longRunByWeek: generatedRows,
        peakBlock: preview.peakBlock,
        planStartDate: planStart,
      })
    : preview.rows;

  async function savePeakAndRegenerate() {
    setRegenerating(true);
    setSectionError(null);
    try {
      const token = await getToken();
      const patchRes = await fetch(`/api/training-plan/${planId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...athleteBearerFetchHeaders(token),
        },
        body: JSON.stringify({
          peakLongRunPoolMiles: draftPeak,
          weeklyMileageTarget,
        }),
      });
      const patchData = (await patchRes.json()) as { error?: string };
      if (!patchRes.ok) {
        throw new Error(patchData.error ?? "Could not save peak pool");
      }

      if (hasSchedule) {
        const genRes = await fetch("/api/training/plan/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...athleteBearerFetchHeaders(token),
          },
          body: JSON.stringify({
            trainingPlanId: planId,
            weeklyMileageTarget,
            minWeeklyMiles: presetMinWeeklyMiles,
          }),
        });
        const genData = (await genRes.json()) as { error?: string };
        if (!genRes.ok) {
          throw new Error(genData.error ?? "Regeneration failed");
        }
        await loadScheduleSummary();
      }

      await onRegenerated?.();
    } catch (e) {
      setSectionError(e instanceof Error ? e.message : "Could not update peak pool");
    } finally {
      setRegenerating(false);
    }
  }

  if (loadingSummary && hasSchedule && generatedRows == null) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
        Loading long-run trajectory…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <LongRunTrajectoryCard
        peakLongRunPoolMiles={draftPeak}
        onPeakLongRunPoolMilesChange={editable ? setDraftPeak : undefined}
        editable={editable}
        totalWeeks={totalWeeks}
        currentWeek={currentWeek}
        rows={rows}
        peakWeekNumber={preview.peakWeekNumber}
        peakBlock={preview.peakBlock}
        previewMode={peakDirty || !hasSchedule}
      />

      {sectionError ? (
        <p className="text-sm text-red-700" role="alert">
          {sectionError}
        </p>
      ) : null}

      {editable && peakDirty && showRegenerate ? (
        <button
          type="button"
          disabled={regenerating}
          onClick={() => void savePeakAndRegenerate()}
          className="inline-flex rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
        >
          {regenerating
            ? hasSchedule
              ? "Saving & regenerating…"
              : "Saving…"
            : hasSchedule
              ? "Save peak pool & regenerate plan"
              : "Save peak pool"}
        </button>
      ) : null}
    </div>
  );
}

/** Resolve blueprint peak + LR positions from plan GET payload. */
export function trajectoryContextFromPlanDetail(plan: {
  peakLongRunPoolMiles?: number | null;
  training_plan_preset?: {
    peakLongRunPoolMiles?: number | null;
    longRunConfig?: {
      positions?: Array<{
        cyclePosition: number;
        catalogueWorkoutId: string | null;
        distributionWeight: number;
      }>;
    } | null;
  } | null;
  athlete_preset?: {
    peakLongRunPoolMiles?: number;
    fitnessPhase?: "BASE" | "PEAK";
    longRunConfig?: {
      positions?: Array<{
        cyclePosition: number;
        catalogueWorkoutId: string | null;
        distributionWeight: number;
      }>;
    } | null;
  } | null;
}): {
  blueprintPeakLongRunPoolMiles: number;
  fitnessPhase: LongRunFitnessPhase;
  longRunPositions: RunTypePosition[];
} {
  const athletePreset = plan.athlete_preset;
  const catalogPreset = plan.training_plan_preset;
  const blueprintPeak =
    athletePreset?.peakLongRunPoolMiles ??
    catalogPreset?.peakLongRunPoolMiles ??
    55;
  const positions =
    athletePreset?.longRunConfig?.positions ??
    catalogPreset?.longRunConfig?.positions ??
    [];
  return {
    blueprintPeakLongRunPoolMiles: blueprintPeak,
    fitnessPhase: athletePreset?.fitnessPhase === "PEAK" ? "PEAK" : "BASE",
    longRunPositions: positions.map((p) => ({
      cyclePosition: p.cyclePosition,
      catalogueWorkoutId: p.catalogueWorkoutId,
      distributionWeight: p.distributionWeight,
    })),
  };
}

export function peakBlockFromCyclePoolData(
  cyclePoolData: unknown,
  totalWeeks: number
): { startWeek: number; endWeek: number } | null {
  if (!cyclePoolData || typeof cyclePoolData !== "object") return null;
  const raw = cyclePoolData as {
    nCycles?: number;
    weeksInCycle?: number[];
  };
  const nCycles = Number(raw.nCycles);
  const weeksInCycle = Array.isArray(raw.weeksInCycle)
    ? raw.weeksInCycle.map(Number)
    : [];
  if (!Number.isFinite(nCycles) || nCycles < 1) return null;
  return peakBlockWeekRange({ totalWeeks, nCycles, weeksInCycle });
}

export { LONG_RUN_BLOCK_WEEKS };
