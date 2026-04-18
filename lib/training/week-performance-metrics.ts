/**
 * Week-level aggregates from materialized `workouts` rows (same date window as `buildPlanWeekCards`).
 * Used by weekly recap cron (`pace_adjustment_log`) and GET `/api/training/plan/week` (live header).
 */

import type { WorkoutType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { effectiveTrainingWeekCount } from "@/lib/training/plan-utils";
import { weekBoundsFromPlan } from "@/lib/training/plan-schedule";
import type { WeekPerformanceSnapshot } from "@/lib/training/week-performance-types";

export type { WeekPerformanceSnapshot } from "@/lib/training/week-performance-types";

export type WeekPerformanceRow = {
  workoutType: WorkoutType | string;
  matchedActivityId: string | null;
  estimatedDistanceInMeters: number | null;
  actualDistanceMeters: number | null;
  paceDeltaSecPerMile: number | null;
};

function isQualityType(t: string): boolean {
  return t === "Tempo" || t === "Intervals";
}

export function computeWeekPerformanceMetrics(
  rows: WeekPerformanceRow[]
): WeekPerformanceSnapshot {
  const sessionsPlanned = rows.length;
  const matchedRows = rows.filter((w) => w.matchedActivityId != null);
  const sessionsCompleted = matchedRows.length;

  const qualityRows = rows.filter((w) => isQualityType(String(w.workoutType)));
  const qualitySessionsPlanned = qualityRows.length;
  const qualityMatched = qualityRows.filter((w) => w.matchedActivityId != null);
  const qualitySessionsCompleted = qualityMatched.length;

  const deltas = qualityMatched
    .map((w) => w.paceDeltaSecPerMile)
    .filter((d): d is number => d != null && Number.isFinite(d));
  const qualityAvgDeltaSecPerMile =
    deltas.length > 0
      ? Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length)
      : null;

  let plannedMetersTotal = 0;
  for (const w of rows) {
    const m = w.estimatedDistanceInMeters;
    if (m != null && Number.isFinite(m) && m > 0) plannedMetersTotal += m;
  }

  let actualMetersMatched = 0;
  for (const w of matchedRows) {
    const m = w.actualDistanceMeters;
    if (m != null && Number.isFinite(m) && m > 0) actualMetersMatched += m;
  }

  const weeklyMileageCompletionPct =
    plannedMetersTotal > 0
      ? Math.min(100, (actualMetersMatched / plannedMetersTotal) * 100)
      : null;

  const longRun = rows.find((w) => String(w.workoutType) === "LongRun");
  let longRunCompleted = false;
  let longRunCompletionRatio: number | null = null;

  if (longRun) {
    const planned =
      longRun.estimatedDistanceInMeters != null &&
      Number.isFinite(longRun.estimatedDistanceInMeters) &&
      longRun.estimatedDistanceInMeters > 0
        ? longRun.estimatedDistanceInMeters
        : 0;
    const actual =
      longRun.actualDistanceMeters != null &&
      Number.isFinite(longRun.actualDistanceMeters) &&
      longRun.actualDistanceMeters > 0
        ? longRun.actualDistanceMeters
        : 0;
    longRunCompleted =
      longRun.matchedActivityId != null && actual > 0;
    if (planned > 0) {
      longRunCompletionRatio = Math.min(1, actual / planned);
    } else if (longRun.matchedActivityId != null && actual > 0) {
      longRunCompletionRatio = 1;
    } else {
      longRunCompletionRatio = 0;
    }
  }

  return {
    sessionsPlanned,
    sessionsCompleted,
    qualitySessionsPlanned,
    qualitySessionsCompleted,
    qualityAvgDeltaSecPerMile,
    plannedMetersTotal,
    actualMetersMatched,
    weeklyMileageCompletionPct,
    longRunCompleted,
    longRunCompletionRatio,
  };
}

function utcDayRange(weekStart: Date, weekEnd: Date): { gte: Date; lte: Date } {
  const gte = new Date(weekStart);
  gte.setUTCHours(0, 0, 0, 0);
  const lte = new Date(weekEnd);
  lte.setUTCHours(23, 59, 59, 999);
  return { gte, lte };
}

/**
 * Loads materialized workouts for the same calendar week as `buildPlanWeekCards` and returns metrics.
 */
export async function loadWeekPerformanceSnapshot(params: {
  planId: string;
  athleteId: string;
  planStartDate: Date;
  weekNumber: number;
  storedTotalWeeks: number;
  raceDate: Date | null;
}): Promise<WeekPerformanceSnapshot> {
  const effectiveWeeks = effectiveTrainingWeekCount(
    params.planStartDate,
    params.storedTotalWeeks,
    params.raceDate
  );

  const { weekStart, weekEnd } = weekBoundsFromPlan(
    params.planStartDate,
    params.weekNumber,
    {
      raceDate: params.raceDate,
      totalWeeks: effectiveWeeks,
    }
  );
  const { gte, lte } = utcDayRange(weekStart, weekEnd);

  const rows = await prisma.workouts.findMany({
    where: {
      planId: params.planId,
      athleteId: params.athleteId,
      date: { gte, lte },
    },
    select: {
      workoutType: true,
      matchedActivityId: true,
      estimatedDistanceInMeters: true,
      actualDistanceMeters: true,
      paceDeltaSecPerMile: true,
    },
  });

  return computeWeekPerformanceMetrics(rows);
}
