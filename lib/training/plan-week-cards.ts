/**
 * Merge `planWeeks` schedule with optional materialized `workouts` rows for one week.
 */

import { prisma } from "@/lib/prisma";
import { utcDateOnly } from "./plan-utils";
import { planScheduleDaysForWeek, weekBoundsFromPlan } from "./plan-schedule";

export type PlanDayCard = {
  /** Present once the athlete has opened this day (lazy materialization). */
  workoutId: string | null;
  dateKey: string;
  date: string;
  title: string;
  workoutType: string;
  phase: string;
  estimatedDistanceInMeters: number;
  matchedActivityId: string | null;
  actualDistanceMeters: number | null;
  actualAvgPaceSecPerMile: number | null;
  actualAverageHeartRate: number | null;
  actualDurationSeconds: number | null;
};

function utcDayRange(weekStart: Date, weekEnd: Date): { gte: Date; lte: Date } {
  const gte = new Date(weekStart);
  gte.setUTCHours(0, 0, 0, 0);
  const lte = new Date(weekEnd);
  lte.setUTCHours(23, 59, 59, 999);
  return { gte, lte };
}

function isoDateKey(d: Date): string {
  return utcDateOnly(d).toISOString().slice(0, 10);
}

export async function buildPlanWeekCards(params: {
  planId: string;
  athleteId: string;
  planStartDate: Date;
  planWeeks: unknown;
  weekNumber: number;
  raceDate: Date | null;
  raceName: string | null;
  raceDistanceMiles: number | null;
}): Promise<PlanDayCard[]> {
  const scheduled = planScheduleDaysForWeek({
    planStartDate: params.planStartDate,
    planWeeks: params.planWeeks,
    weekNumber: params.weekNumber,
    raceDate: params.raceDate,
    raceName: params.raceName,
    raceDistanceMiles: params.raceDistanceMiles,
  });

  const { weekStart, weekEnd } = weekBoundsFromPlan(
    params.planStartDate,
    params.weekNumber
  );
  const { gte, lte } = utcDayRange(weekStart, weekEnd);

  const materialized = await prisma.workouts.findMany({
    where: {
      planId: params.planId,
      athleteId: params.athleteId,
      date: { gte, lte },
    },
    orderBy: { date: "asc" },
  });

  const byDateKey = new Map<
    string,
    (typeof materialized)[number]
  >();
  for (const w of materialized) {
    if (w.date) {
      byDateKey.set(isoDateKey(w.date), w);
    }
  }

  return scheduled.map((s) => {
    const row = byDateKey.get(s.dateKey);
    return {
      workoutId: row?.id ?? null,
      dateKey: s.dateKey,
      date: s.dateKey,
      title: row?.title ?? s.title,
      workoutType: row?.workoutType ?? s.workoutType,
      phase: s.phase,
      estimatedDistanceInMeters:
        row?.estimatedDistanceInMeters ?? s.estimatedDistanceInMeters,
      matchedActivityId: row?.matchedActivityId ?? null,
      actualDistanceMeters: row?.actualDistanceMeters ?? null,
      actualAvgPaceSecPerMile: row?.actualAvgPaceSecPerMile ?? null,
      actualAverageHeartRate: row?.actualAverageHeartRate ?? null,
      actualDurationSeconds: row?.actualDurationSeconds ?? null,
    };
  });
}
