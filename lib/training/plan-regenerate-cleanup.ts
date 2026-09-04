/**
 * After regenerating or superseding a plan: remove future uncompleted workout rows
 * so lazy materialization rebuilds from the new planSchedule instead of stale rows.
 */

import { prisma } from "@/lib/prisma";
import { utcDateOnly } from "@/lib/training/plan-utils";

export type RegenerateWorkoutCleanupResult = {
  clearedFutureWorkouts: number;
  clearedFuturePlannedWorkouts: number;
};

const EMPTY_CLEANUP: RegenerateWorkoutCleanupResult = {
  clearedFutureWorkouts: 0,
  clearedFuturePlannedWorkouts: 0,
};

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
        garminDetailActivityId: null,
        date: { gte: todayUtc },
      },
      select: { id: true },
    }),
    prisma.planned_workouts.findMany({
      where: {
        planId: params.planId,
        athleteId: params.athleteId,
        date: { gte: todayUtc },
      },
      select: { id: true },
    }),
  ]);

  if (workouts.length === 0 && plannedWorkouts.length === 0) return EMPTY_CLEANUP;

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
  };
}

/** When parking/archiving a superseded plan — clear its future materialized rows. */
export async function cleanupFutureWorkoutsForRetiredPlan(params: {
  planId: string;
  athleteId: string;
}): Promise<RegenerateWorkoutCleanupResult> {
  return cleanupFuturePlanWorkoutsAfterRegenerate(params);
}
