/**
 * Merge persisted `training_plans.planSchedule` with planned_workouts (+ spawned instance actuals).
 */

import { prisma } from "@/lib/prisma";
import { effectiveTrainingWeekCount, utcDateOnly } from "./plan-utils";
import { planScheduleDaysForWeek, weekBoundsFromPlan } from "./plan-schedule";
import { loadCatalogueTitleByIdForWeekSchedule } from "./catalogue-title-map";
import { mergePlanDayTitle } from "./workout-display-title";

export type PlanDayCard = {
  /** Planned prescribe row id (canonical calendar key). */
  plannedWorkoutId: string | null;
  /** Spawned instance id when the athlete has run / opened post-match detail. */
  workoutId: string | null;
  dateKey: string;
  date: string;
  title: string;
  workoutType: string;
  phase: string;
  dayAssigned?: string | null;
  estimatedDistanceInMeters: number;
  matchedActivityId: string | null;
  skippedAt: string | null;
  skipReason: string | null;
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
  planSchedule?: unknown;
  /** @deprecated use planSchedule */
  planWeeks?: unknown;
  weekNumber: number;
  storedTotalWeeks: number;
  raceDate: Date | null;
  raceName: string | null;
  raceDistanceMiles: number | null;
}): Promise<PlanDayCard[]> {
  const effectiveWeeks = effectiveTrainingWeekCount(
    params.planStartDate,
    params.storedTotalWeeks,
    params.raceDate
  );

  const rawSchedule = params.planSchedule ?? params.planWeeks;
  const catalogueTitleById = await loadCatalogueTitleByIdForWeekSchedule(
    rawSchedule,
    params.weekNumber,
    effectiveWeeks
  );

  const scheduled = planScheduleDaysForWeek({
    planStartDate: params.planStartDate,
    planSchedule: rawSchedule,
    weekNumber: params.weekNumber,
    raceDate: params.raceDate,
    raceName: params.raceName,
    raceDistanceMiles: params.raceDistanceMiles,
    totalWeeks: effectiveWeeks,
    catalogueTitleById,
  });

  const { weekStart, weekEnd } = weekBoundsFromPlan(
    params.planStartDate,
    params.weekNumber,
    {
      raceDate: params.raceDate,
      totalWeeks: effectiveWeeks,
    }
  );
  const { gte, lte } = utcDayRange(weekStart, weekEnd);

  const materializedPlanned = await prisma.planned_workouts.findMany({
    where: {
      planId: params.planId,
      athleteId: params.athleteId,
      date: { gte, lte },
    },
    orderBy: { date: "asc" },
  });

  const plannedIds = materializedPlanned.map((p) => p.id);
  const spawnedInstances =
    plannedIds.length > 0
      ? await prisma.workouts.findMany({
          where: {
            athleteId: params.athleteId,
            plannedWorkoutId: { in: plannedIds },
          },
          orderBy: { updatedAt: "desc" },
        })
      : [];

  const instanceByPlannedId = new Map<string, (typeof spawnedInstances)[number]>();
  for (const inst of spawnedInstances) {
    if (inst.plannedWorkoutId && !instanceByPlannedId.has(inst.plannedWorkoutId)) {
      instanceByPlannedId.set(inst.plannedWorkoutId, inst);
    }
  }

  const byDateKey = new Map<string, (typeof materializedPlanned)[number]>();
  for (const p of materializedPlanned) {
    byDateKey.set(isoDateKey(p.date), p);
  }

  return scheduled.map((s) => {
    const planned = byDateKey.get(s.dateKey);
    const instance = planned ? instanceByPlannedId.get(planned.id) : undefined;
    const workoutType = planned?.workoutType ?? instance?.workoutType ?? s.workoutType;
    const estimatedDistanceInMeters =
      planned?.estimatedDistanceInMeters ??
      instance?.estimatedDistanceInMeters ??
      s.estimatedDistanceInMeters;
    return {
      plannedWorkoutId: planned?.id ?? null,
      workoutId: instance?.id ?? null,
      dateKey: s.dateKey,
      date: s.dateKey,
      title: mergePlanDayTitle({
        rowTitle: planned?.title ?? instance?.title,
        scheduleTitle: s.title,
        workoutType,
        estimatedDistanceInMeters,
        dayAssigned: s.dayAssigned,
        planId: params.planId,
      }),
      workoutType,
      phase: s.phase,
      dayAssigned: s.dayAssigned,
      estimatedDistanceInMeters,
      matchedActivityId: instance?.matchedActivityId ?? null,
      skippedAt: instance?.skippedAt?.toISOString() ?? null,
      skipReason: instance?.skipReason ?? null,
      actualDistanceMeters: instance?.actualDistanceMeters ?? null,
      actualAvgPaceSecPerMile: instance?.actualAvgPaceSecPerMile ?? null,
      actualAverageHeartRate: instance?.actualAverageHeartRate ?? null,
      actualDurationSeconds: instance?.actualDurationSeconds ?? null,
    };
  });
}
