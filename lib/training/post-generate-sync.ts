/**
 * After plan generate or replace: materialize upcoming workout rows (server-side).
 * Garmin sends stay on the athlete tap or the 5 AM Eastern daily cron — not bulk push here.
 */

import { ensureWorkoutHorizonForAthlete } from "@/lib/training/ensure-workout-horizon";
import { localTodayKey } from "@/lib/training/plan-utils";

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

  return {
    horizon,
    garmin: {
      attempted: false,
      summary: null,
      skippedReason: "post_generate_garmin_push_disabled",
    },
  };
}
