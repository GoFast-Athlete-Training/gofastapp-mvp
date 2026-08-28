/**
 * After regenerating or superseding a plan: remove future uncompleted workout rows
 * so lazy materialization rebuilds from the new planSchedule instead of stale rows.
 * Known Garmin calendar schedules are unscheduled first to avoid duplicate entries.
 */

import { prisma } from "@/lib/prisma";
import { GarminNotConnectedError, requireGarminTokenFresh } from "@/lib/domain-garmin";
import { createGarminTrainingApiForAthlete } from "@/lib/garmin-workouts/garmin-training-api";
import { deleteGarminScheduleIfPresent } from "@/lib/garmin-workouts/garmin-schedule-service";
import { utcDateOnly } from "@/lib/training/plan-utils";

export type RegenerateWorkoutCleanupResult = {
  clearedFutureWorkouts: number;
  clearedFuturePlannedWorkouts: number;
  garminSchedulesDeleted: number;
  garminSchedulesStale: number;
  garminScheduleDeleteErrors: number;
};

const EMPTY_CLEANUP: RegenerateWorkoutCleanupResult = {
  clearedFutureWorkouts: 0,
  clearedFuturePlannedWorkouts: 0,
  garminSchedulesDeleted: 0,
  garminSchedulesStale: 0,
  garminScheduleDeleteErrors: 0,
};

async function unscheduleGarminIds(params: {
  planId: string;
  athleteId: string;
  scheduleIds: number[];
}): Promise<Pick<
  RegenerateWorkoutCleanupResult,
  "garminSchedulesDeleted" | "garminSchedulesStale" | "garminScheduleDeleteErrors"
>> {
  let garminSchedulesDeleted = 0;
  let garminSchedulesStale = 0;
  let garminScheduleDeleteErrors = 0;

  if (scheduleIds.length === 0) {
    return { garminSchedulesDeleted, garminSchedulesStale, garminScheduleDeleteErrors };
  }

  try {
    const token = await requireGarminTokenFresh(params.athleteId);
    const client = createGarminTrainingApiForAthlete(params.athleteId, token);

    for (const scheduleId of scheduleIds) {
      try {
        const result = await deleteGarminScheduleIfPresent(client, scheduleId);
        if (result.wasStaleOnGarmin) {
          garminSchedulesStale++;
        } else {
          garminSchedulesDeleted++;
        }
      } catch (e) {
        garminScheduleDeleteErrors++;
        console.warn("[plan-regenerate-cleanup] Garmin schedule delete failed", {
          planId: params.planId,
          athleteId: params.athleteId,
          scheduleId,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  } catch (e) {
    if (!(e instanceof GarminNotConnectedError)) {
      garminScheduleDeleteErrors += scheduleIds.length;
      console.warn("[plan-regenerate-cleanup] Garmin unschedule skipped", {
        planId: params.planId,
        athleteId: params.athleteId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { garminSchedulesDeleted, garminSchedulesStale, garminScheduleDeleteErrors };
}

/**
 * After regenerating a plan schedule, remove future uncompleted workout rows so
 * lazy materialization rebuilds from the new planSchedule instead of stale rows.
 */
export async function cleanupFuturePlanWorkoutsAfterRegenerate(params: {
  planId: string;
  athleteId: string;
}): Promise<RegenerateWorkoutCleanupResult> {
  const todayUtc = utcDateOnly(new Date());

  const [workouts, plannedWorkouts] = await Promise.all([
    prisma.workouts.findMany({
      where: {
        planId: params.planId,
        athleteId: params.athleteId,
        matchedActivityId: null,
        date: { gte: todayUtc },
      },
      select: { id: true, garminScheduleId: true },
    }),
    prisma.planned_workouts.findMany({
      where: {
        planId: params.planId,
        athleteId: params.athleteId,
        date: { gte: todayUtc },
      },
      select: { id: true, garminScheduleId: true },
    }),
  ]);

  if (workouts.length === 0 && plannedWorkouts.length === 0) return EMPTY_CLEANUP;

  const scheduleIds = [
    ...new Set(
      [...workouts, ...plannedWorkouts]
        .map((w) => w.garminScheduleId)
        .filter((id): id is number => id != null && Number.isFinite(id))
    ),
  ];

  const garmin = await unscheduleGarminIds({
    planId: params.planId,
    athleteId: params.athleteId,
    scheduleIds,
  });

  const workoutIds = workouts.map((w) => w.id);
  const plannedIds = plannedWorkouts.map((w) => w.id);

  await prisma.$transaction(async (tx) => {
    if (workoutIds.length > 0) {
      await tx.workout_segments.deleteMany({ where: { workoutId: { in: workoutIds } } });
      await tx.workouts.deleteMany({ where: { id: { in: workoutIds } } });
    }
    if (plannedIds.length > 0) {
      await tx.planned_workout_segments.deleteMany({
        where: { plannedWorkoutId: { in: plannedIds } },
      });
      await tx.planned_workouts.deleteMany({ where: { id: { in: plannedIds } } });
    }
  });

  return {
    clearedFutureWorkouts: workoutIds.length,
    clearedFuturePlannedWorkouts: plannedIds.length,
    ...garmin,
  };
}

/** When parking/archiving a superseded plan — clear its future materialized rows. */
export async function cleanupFutureWorkoutsForRetiredPlan(params: {
  planId: string;
  athleteId: string;
}): Promise<RegenerateWorkoutCleanupResult> {
  return cleanupFuturePlanWorkoutsAfterRegenerate(params);
}
