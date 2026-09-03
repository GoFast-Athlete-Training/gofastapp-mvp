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
  /** Execution workouts.id — stamped on planned_workouts or spawned instance. */
  workoutId: string | null;
  /** Stamped on planned_workouts when ingest bolted a completed workout. */
  workoutCompleted: boolean;
  dateKey: string;
  date: string;
  title: string;
  workoutType: string;
  phase: string;
  dayAssigned?: string | null;
  estimatedDistanceInMeters: number;
  garminDetailActivityId: string | null;
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
  const stampedWorkoutIds = materializedPlanned
    .map((p) => p.workoutId)
    .filter((id): id is string => Boolean(id));
  const instanceLookupIds = [...new Set([...plannedIds, ...stampedWorkoutIds])];
  const spawnedInstances =
    instanceLookupIds.length > 0
      ? await prisma.workouts.findMany({
          where: {
            athleteId: params.athleteId,
            OR: [
              { id: { in: instanceLookupIds } },
              { plannedWorkoutId: { in: plannedIds } },
            ],
          },
          orderBy: { updatedAt: "desc" },
        })
      : [];

  const instanceByPlannedId = new Map<string, (typeof spawnedInstances)[number]>();
  const instanceById = new Map<string, (typeof spawnedInstances)[number]>();
  for (const inst of spawnedInstances) {
    instanceById.set(inst.id, inst);
    let plannedKey: string | null = null;
    if (plannedIds.includes(inst.id)) {
      plannedKey = inst.id;
    } else if (
      inst.plannedWorkoutId &&
      plannedIds.includes(inst.plannedWorkoutId)
    ) {
      plannedKey = inst.plannedWorkoutId;
    }
    if (plannedKey && !instanceByPlannedId.has(plannedKey)) {
      instanceByPlannedId.set(plannedKey, inst);
    }
  }

  const byDateKey = new Map<string, (typeof materializedPlanned)[number]>();
  for (const p of materializedPlanned) {
    byDateKey.set(isoDateKey(p.date), p);
  }

  return scheduled.map((s) => {
    const planned = byDateKey.get(s.dateKey);
    const instance = planned ? instanceByPlannedId.get(planned.id) : undefined;
    const stampedWorkoutId = planned?.workoutId ?? null;
    const workoutCompleted = planned?.workoutCompleted ?? false;
    const executionWorkoutId =
      stampedWorkoutId ?? instance?.id ?? null;
    const executionInstance =
      (stampedWorkoutId ? instanceById.get(stampedWorkoutId) : undefined) ??
      instance;
    const workoutType = planned?.workoutType ?? instance?.workoutType ?? s.workoutType;
    const estimatedDistanceInMeters =
      planned?.estimatedDistanceInMeters ??
      instance?.estimatedDistanceInMeters ??
      s.estimatedDistanceInMeters;
    return {
      plannedWorkoutId: planned?.id ?? null,
      workoutId: executionWorkoutId,
      workoutCompleted,
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
      garminDetailActivityId: executionInstance?.garminDetailActivityId ?? null,
      skippedAt: executionInstance?.skippedAt?.toISOString() ?? null,
      skipReason: executionInstance?.skipReason ?? null,
      actualDistanceMeters: executionInstance?.actualDistanceMeters ?? null,
      actualAvgPaceSecPerMile: executionInstance?.actualAvgPaceSecPerMile ?? null,
      actualAverageHeartRate: executionInstance?.actualAverageHeartRate ?? null,
      actualDurationSeconds: executionInstance?.actualDurationSeconds ?? null,
    };
  });
}
