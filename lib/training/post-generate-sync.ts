/**
 * After plan generate or replace: materialize horizon and push to Garmin (server-side).
 * Mobile / web open is not required.
 */

import { prisma } from "@/lib/prisma";
import { GarminNotConnectedError } from "@/lib/domain-garmin";
import { pushPlanWorkoutsInDateRange } from "@/lib/garmin-workouts/push-plan-workouts-batch";
import { ensureWorkoutHorizonForAthlete } from "@/lib/training/ensure-workout-horizon";
import {
  addDaysUtc,
  localTodayKey,
  utcDateOnly,
  ymdFromDate,
} from "@/lib/training/plan-utils";

export type PostGenerateSyncResult = {
  horizon: Awaited<ReturnType<typeof ensureWorkoutHorizonForAthlete>>;
  garmin: {
    attempted: boolean;
    summary: {
      candidateCount: number;
      scheduled: number;
      updated: number;
      skipped: number;
      failed: number;
    } | null;
    skippedReason: string | null;
  };
};

const DEFAULT_HORIZON_DAYS = 14;

export async function syncPlanAfterGenerate(params: {
  athleteId: string;
  horizonDays?: number;
}): Promise<PostGenerateSyncResult> {
  const startDateKey = localTodayKey();
  const days = params.horizonDays ?? DEFAULT_HORIZON_DAYS;

  const horizon = await ensureWorkoutHorizonForAthlete({
    athleteId: params.athleteId,
    days,
    startDateKey,
  });

  const athlete = await prisma.athlete.findUnique({
    where: { id: params.athleteId },
    select: { garmin_access_token: true, garmin_user_id: true },
  });

  const garminConnected = Boolean(
    athlete?.garmin_access_token?.trim() && athlete?.garmin_user_id?.trim()
  );

  if (!garminConnected || !horizon.planId) {
    return {
      horizon,
      garmin: {
        attempted: false,
        summary: null,
        skippedReason: !horizon.planId
          ? "no_active_plan_with_schedule"
          : "garmin_not_connected",
      },
    };
  }

  const dateStart = utcDateOnly(new Date(`${startDateKey}T00:00:00.000Z`));
  const dateEnd = addDaysUtc(dateStart, days - 1);
  dateEnd.setUTCHours(23, 59, 59, 999);

  try {
    const { summary } = await pushPlanWorkoutsInDateRange({
      dateStart,
      dateEnd,
      athleteIds: [params.athleteId],
      candidateLimit: 80,
      runLabel: "post-generate-sync",
      unsentOnly: true,
    });

    return {
      horizon,
      garmin: {
        attempted: true,
        summary,
        skippedReason: null,
      },
    };
  } catch (e) {
    if (e instanceof GarminNotConnectedError) {
      return {
        horizon,
        garmin: {
          attempted: false,
          summary: null,
          skippedReason: "garmin_not_connected",
        },
      };
    }
    console.error("[post-generate-sync] Garmin push failed", {
      athleteId: params.athleteId,
      planId: horizon.planId,
      error: e instanceof Error ? e.message : String(e),
    });
    return {
      horizon,
      garmin: {
        attempted: true,
        summary: {
          candidateCount: 0,
          scheduled: 0,
          updated: 0,
          skipped: 0,
          failed: 1,
        },
        skippedReason: e instanceof Error ? e.message : "garmin_push_failed",
      },
    };
  }
}
