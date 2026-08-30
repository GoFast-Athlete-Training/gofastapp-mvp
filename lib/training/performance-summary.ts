/**
 * Performance tab rollup — active plan week snapshot + pending 5K confirmations.
 */

import { TrainingPlanLifecycle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parsePaceToSecondsPerMile } from "@/lib/workout-generator/pace-calculator";
import {
  computeFiveKPaceSuggestion,
  type FiveKPaceSuggestion,
} from "@/lib/training/workout-pace-performance";
import {
  currentTrainingWeekNumber,
  effectiveTrainingWeekCount,
} from "@/lib/training/plan-utils";
import { loadWeekPerformanceSnapshot } from "@/lib/training/week-performance-metrics";
import type { WeekPerformanceSnapshot } from "@/lib/training/week-performance-types";

export type PendingFiveKConfirmation = {
  workoutId: string;
  title: string;
  date: string | null;
  workoutType: string;
  suggestion: FiveKPaceSuggestion;
};

export type PerformanceSummary = {
  planId: string | null;
  planName: string | null;
  weekNumber: number | null;
  weekPerformance: WeekPerformanceSnapshot | null;
  currentFiveKPace: string | null;
  pendingFiveKConfirmations: PendingFiveKConfirmation[];
};

export async function loadPerformanceSummary(
  athleteId: string
): Promise<PerformanceSummary> {
  const [athlete, activePlan] = await Promise.all([
    prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { fiveKPace: true },
    }),
    prisma.training_plans.findFirst({
      where: { athleteId, lifecycleStatus: TrainingPlanLifecycle.ACTIVE },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        startDate: true,
        totalWeeks: true,
        race_registry: { select: { raceDate: true } },
      },
    }),
  ]);

  let weekPerformance: WeekPerformanceSnapshot | null = null;
  let weekNumber: number | null = null;

  if (activePlan) {
    const effectiveWeeks = effectiveTrainingWeekCount(
      activePlan.startDate,
      activePlan.totalWeeks,
      activePlan.race_registry?.raceDate ?? null
    );
    weekNumber = currentTrainingWeekNumber(activePlan.startDate, effectiveWeeks);
    weekPerformance = await loadWeekPerformanceSnapshot({
      planId: activePlan.id,
      athleteId,
      planStartDate: activePlan.startDate,
      weekNumber,
      storedTotalWeeks: activePlan.totalWeeks,
      raceDate: activePlan.race_registry?.raceDate ?? null,
    });
  }

  let currentFiveKSecPerMile: number | null = null;
  try {
    if (athlete?.fiveKPace?.trim()) {
      currentFiveKSecPerMile = parsePaceToSecondsPerMile(athlete.fiveKPace.trim());
    }
  } catch {
    currentFiveKSecPerMile = null;
  }

  const pendingRows = await prisma.workouts.findMany({
    where: {
      athleteId,
      matchedActivityId: { not: null },
      workoutType: { in: ["Intervals", "Race"] },
      creditedFiveKPaceSecPerMile: { not: null },
    },
    orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
    take: 10,
    select: {
      id: true,
      title: true,
      date: true,
      workoutType: true,
      actualAvgPaceSecPerMile: true,
      paceDeltaSecPerMile: true,
      creditedFiveKPaceSecPerMile: true,
      workout_catalogue: {
        select: { workBasePaceOffsetSecPerMile: true },
      },
      segments: {
        select: {
          segment_laps: { select: { paceDeltaSecPerMile: true } },
        },
      },
    },
  });

  const pendingFiveKConfirmations: PendingFiveKConfirmation[] = [];
  for (const row of pendingRows) {
    const lapDeltas = row.segments.flatMap((s) =>
      s.segment_laps
        .map((l) => l.paceDeltaSecPerMile)
        .filter((d): d is number => d != null && Number.isFinite(d))
    );
    const avgLapDelta =
      lapDeltas.length > 0
        ? Math.round(lapDeltas.reduce((a, b) => a + b, 0) / lapDeltas.length)
        : row.paceDeltaSecPerMile;

    const suggestion = computeFiveKPaceSuggestion({
      workoutType: row.workoutType,
      paceSecPerMile: row.actualAvgPaceSecPerMile,
      paceDeltaSecPerMile: avgLapDelta,
      currentFiveKSecPerMile,
      intervalsCatalogueOffsetSecPerMile:
        row.workout_catalogue?.workBasePaceOffsetSecPerMile ?? null,
    });

    if (suggestion.eligible && suggestion.suggestedFiveKSecPerMile != null) {
      pendingFiveKConfirmations.push({
        workoutId: row.id,
        title: row.title,
        date: row.date?.toISOString() ?? null,
        workoutType: row.workoutType,
        suggestion,
      });
    }
  }

  return {
    planId: activePlan?.id ?? null,
    planName: activePlan?.name ?? null,
    weekNumber,
    weekPerformance,
    currentFiveKPace: athlete?.fiveKPace ?? null,
    pendingFiveKConfirmations,
  };
}
