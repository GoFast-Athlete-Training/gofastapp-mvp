import { prisma } from "@/lib/prisma";
import { GarminNotConnectedError, requireGarminTokenFresh } from "@/lib/domain-garmin";
import { createGarminTrainingApiForAthlete } from "@/lib/garmin-workouts/garmin-training-api";
import { deleteGarminScheduleIfPresent } from "@/lib/garmin-workouts/garmin-schedule-service";
import { utcDateOnly } from "@/lib/training/plan-utils";

export type PlanGarminCleanupResult = {
  garminSchedulesDeleted: number;
  garminSchedulesStale: number;
  garminScheduleDeleteErrors: number;
  clearedScheduleIds: number;
};

const EMPTY: PlanGarminCleanupResult = {
  garminSchedulesDeleted: 0,
  garminSchedulesStale: 0,
  garminScheduleDeleteErrors: 0,
  clearedScheduleIds: 0,
};

/**
 * Unschedule future Garmin calendar entries for a plan without deleting local rows.
 * Used on archive and before hard delete so workouts do not linger on Garmin Connect.
 */
export async function cleanupFutureGarminSchedulesForPlan(params: {
  planId: string;
  athleteId: string;
}): Promise<PlanGarminCleanupResult> {
  const todayUtc = utcDateOnly(new Date());

  const [plannedRows, workoutRows] = await Promise.all([
    prisma.planned_workouts.findMany({
      where: {
        planId: params.planId,
        athleteId: params.athleteId,
        date: { gte: todayUtc },
        garminScheduleId: { not: null },
      },
      select: { id: true, garminScheduleId: true },
    }),
    prisma.workouts.findMany({
      where: {
        planId: params.planId,
        athleteId: params.athleteId,
        garminDetailActivityId: null,
        date: { gte: todayUtc },
        garminScheduleId: { not: null },
      },
      select: { id: true, garminScheduleId: true },
    }),
  ]);

  const scheduleIds = [
    ...new Set(
      [...plannedRows, ...workoutRows]
        .map((r) => r.garminScheduleId)
        .filter((id): id is number => id != null && Number.isFinite(id))
    ),
  ];

  if (scheduleIds.length === 0) return EMPTY;

  let garminSchedulesDeleted = 0;
  let garminSchedulesStale = 0;
  let garminScheduleDeleteErrors = 0;

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
        console.warn("[plan-garmin-cleanup] Garmin schedule delete failed", {
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
      console.warn("[plan-garmin-cleanup] Garmin unschedule skipped", {
        planId: params.planId,
        athleteId: params.athleteId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    if (plannedRows.length > 0) {
      await tx.planned_workouts.updateMany({
        where: { id: { in: plannedRows.map((r) => r.id) } },
        data: { garminScheduleId: null, updatedAt: now },
      });
    }
    if (workoutRows.length > 0) {
      await tx.workouts.updateMany({
        where: { id: { in: workoutRows.map((r) => r.id) } },
        data: { garminScheduleId: null, updatedAt: now },
      });
    }
  });

  return {
    garminSchedulesDeleted,
    garminSchedulesStale,
    garminScheduleDeleteErrors,
    clearedScheduleIds: scheduleIds.length,
  };
}
