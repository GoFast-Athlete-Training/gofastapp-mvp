import { TrainingPlanLifecycle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { materializeTodayPlanWorkoutForAthlete } from "@/lib/training/materialize-todays-plan-workout";
import { ymdFromDate } from "@/lib/training/plan-utils";
import {
  pushPlanWorkoutsInDateRange,
  type GarminPlanWorkoutPushResult,
  type PushPlanWorkoutsBatchSummary,
} from "@/lib/garmin-workouts/push-plan-workouts-batch";

export type DailyGarminPushFallbackResult = {
  todayYmd: string;
  materializeResults: Array<{
    athleteId: string;
    status: string;
    workoutId?: string;
    message?: string;
  }>;
  summary: PushPlanWorkoutsBatchSummary;
  results: GarminPlanWorkoutPushResult[];
};

/**
 * Morning fallback: materialize today's plan workout, then push unsent rows to Garmin.
 * Used when the athlete cannot open the app (auth outage) or forgot to tap Send.
 */
export async function runDailyGarminPushFallback(
  now: Date = new Date()
): Promise<DailyGarminPushFallbackResult> {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);
  const todayYmd = ymdFromDate(now);

  const activePlans = await prisma.training_plans.findMany({
    where: {
      lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
      Athlete: {
        garmin_access_token: { not: null },
        garmin_user_id: { not: null },
      },
    },
    select: { athleteId: true },
    take: 80,
  });

  const materializeResults: DailyGarminPushFallbackResult["materializeResults"] =
    [];
  const seenAthletes = new Set<string>();

  for (const row of activePlans) {
    if (seenAthletes.has(row.athleteId)) continue;
    seenAthletes.add(row.athleteId);
    const m = await materializeTodayPlanWorkoutForAthlete(row.athleteId, todayYmd);
    materializeResults.push({
      athleteId: row.athleteId,
      status: m.status,
      ...(m.status === "materialized" ? { workoutId: m.workoutId } : {}),
      ...(m.status === "error" ? { message: m.message } : {}),
    });
  }

  const { results, summary } = await pushPlanWorkoutsInDateRange({
    dateStart: start,
    dateEnd: end,
    candidateLimit: 80,
    runLabel: "auto-push-garmin",
    unsentOnly: true,
  });

  console.info("[auto-push-garmin] daily fallback complete", {
    todayYmd,
    athleteCount: seenAthletes.size,
    ...summary,
  });

  return {
    todayYmd,
    materializeResults,
    summary,
    results,
  };
}
