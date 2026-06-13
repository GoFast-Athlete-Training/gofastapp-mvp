import { TrainingPlanLifecycle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureWorkoutHorizonForAthlete } from "@/lib/training/ensure-workout-horizon";
import {
  addDaysUtc,
  mondayUtcOfWeekContaining,
  utcDateOnly,
  ymdFromDate,
} from "@/lib/training/plan-utils";
import {
  pushPlanWorkoutsInDateRange,
  type GarminPlanWorkoutPushResult,
  type PushPlanWorkoutsBatchSummary,
} from "@/lib/garmin-workouts/push-plan-workouts-batch";

export type WeeklyGarminPushResult = {
  weekStartYmd: string;
  weekEndYmd: string;
  athleteCount: number;
  horizonPreflight: Array<{
    athleteId: string;
    changed: boolean;
    materialized: number;
    alreadyReady: number;
    errors: number;
  }>;
  push: PushPlanWorkoutsBatchSummary;
  results: GarminPlanWorkoutPushResult[];
};

function sundayEndUtc(monday: Date): Date {
  const end = addDaysUtc(monday, 6);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

/**
 * Weekly Garmin pre-push: ensure the 14-day horizon, then push Mon–Sun plan workouts
 * for Garmin-connected athletes with active training plans.
 */
export async function runWeeklyGarminPushForActivePlans(
  now: Date = new Date()
): Promise<WeeklyGarminPushResult> {
  const weekStart = mondayUtcOfWeekContaining(now);
  const weekEnd = sundayEndUtc(weekStart);
  const weekStartYmd = ymdFromDate(weekStart);
  const weekEndYmd = ymdFromDate(utcDateOnly(weekEnd));
  const horizonStartYmd = ymdFromDate(utcDateOnly(now));

  const athletes = await prisma.athlete.findMany({
    where: {
      garmin_access_token: { not: null },
      garmin_user_id: { not: null },
      training_plans: {
        some: { lifecycleStatus: TrainingPlanLifecycle.ACTIVE },
      },
    },
    select: { id: true },
  });

  const athleteIds = athletes.map((a) => a.id);
  const horizonPreflight: WeeklyGarminPushResult["horizonPreflight"] = [];

  for (const athleteId of athleteIds) {
    const horizon = await ensureWorkoutHorizonForAthlete({
      athleteId,
      days: 14,
      startDateKey: horizonStartYmd,
    });
    horizonPreflight.push({
      athleteId,
      changed: horizon.changed,
      materialized: horizon.summary.materialized,
      alreadyReady: horizon.summary.alreadyReady,
      errors: horizon.summary.errors,
    });
  }

  const { results, summary } = await pushPlanWorkoutsInDateRange({
    dateStart: weekStart,
    dateEnd: weekEnd,
    candidateLimit: 200,
    runLabel: "weekly-push-garmin",
    recoverLibraryOnly: true,
    athleteIds,
  });

  return {
    weekStartYmd,
    weekEndYmd,
    athleteCount: athleteIds.length,
    horizonPreflight,
    push: summary,
    results,
  };
}
