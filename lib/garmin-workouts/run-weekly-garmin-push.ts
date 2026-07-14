import { TrainingPlanLifecycle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureWorkoutHorizonForAthlete } from "@/lib/training/ensure-workout-horizon";
import {
  addDaysUtc,
  mondayUtcOfWeekContaining,
  utcDateOnly,
  ymdFromDate,
} from "@/lib/training/plan-utils";
import type {
  GarminPlanWorkoutPushResult,
  PushPlanWorkoutsBatchSummary,
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

const EMPTY_PUSH_SUMMARY: PushPlanWorkoutsBatchSummary = {
  candidateCount: 0,
  scheduled: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
};

/**
 * Weekly Garmin horizon preflight only — materialize upcoming plan workouts but do not
 * auto-push to Garmin. Athletes verify and send explicitly from the app.
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

  console.info("[weekly-push-garmin] horizon preflight only — Garmin auto-push disabled", {
    weekStartYmd,
    weekEndYmd,
    athleteCount: athleteIds.length,
  });

  return {
    weekStartYmd,
    weekEndYmd,
    athleteCount: athleteIds.length,
    horizonPreflight,
    push: EMPTY_PUSH_SUMMARY,
    results: [] as GarminPlanWorkoutPushResult[],
  };
}
