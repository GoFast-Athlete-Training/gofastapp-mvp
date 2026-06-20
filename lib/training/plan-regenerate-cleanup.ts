import { prisma } from "@/lib/prisma";
import { GarminNotConnectedError, requireGarminTokenFresh } from "@/lib/domain-garmin";
import { createGarminTrainingApiForAthlete } from "@/lib/garmin-workouts/garmin-training-api";
import { deleteGarminScheduleIfPresent } from "@/lib/garmin-workouts/garmin-schedule-service";
import { utcDateOnly } from "@/lib/training/plan-utils";

export type RegenerateWorkoutCleanupResult = {
  clearedFutureWorkouts: number;
  garminSchedulesDeleted: number;
  garminSchedulesStale: number;
  garminScheduleDeleteErrors: number;
};

const EMPTY_CLEANUP: RegenerateWorkoutCleanupResult = {
  clearedFutureWorkouts: 0,
  garminSchedulesDeleted: 0,
  garminSchedulesStale: 0,
  garminScheduleDeleteErrors: 0,
};

/**
 * After regenerating a plan schedule, remove future uncompleted workout rows so
 * lazy materialization rebuilds from the new planSchedule instead of stale rows.
 * Known Garmin calendar schedules are unscheduled first to avoid duplicate entries.
 */
export async function cleanupFuturePlanWorkoutsAfterRegenerate(params: {
  planId: string;
  athleteId: string;
}): Promise<RegenerateWorkoutCleanupResult> {
  const todayUtc = utcDateOnly(new Date());
  const workouts = await prisma.workouts.findMany({
    where: {
      planId: params.planId,
      athleteId: params.athleteId,
      matchedActivityId: null,
      date: { gte: todayUtc },
    },
    select: { id: true, garminScheduleId: true },
  });
  if (workouts.length === 0) return EMPTY_CLEANUP;

  let garminSchedulesDeleted = 0;
  let garminSchedulesStale = 0;
  let garminScheduleDeleteErrors = 0;

  const scheduleIds = [
    ...new Set(
      workouts
        .map((w) => w.garminScheduleId)
        .filter((id): id is number => id != null && Number.isFinite(id))
    ),
  ];

  if (scheduleIds.length > 0) {
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
  }

  const ids = workouts.map((w) => w.id);
  await prisma.$transaction(async (tx) => {
    await tx.workout_segments.deleteMany({ where: { workoutId: { in: ids } } });
    await tx.workouts.deleteMany({ where: { id: { in: ids } } });
  });

  return {
    clearedFutureWorkouts: ids.length,
    garminSchedulesDeleted,
    garminSchedulesStale,
    garminScheduleDeleteErrors,
  };
}
