/**
 * Race finish close-out window and plan build stats.
 */

import { TrainingPlanLifecycle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { raceCalendarDaysFromTodayUtc } from "@/lib/race-calendar-phase";
import { metersToMiles } from "@/lib/pace-utils";

/** Days after race day the plan stays ACTIVE for result + reflection. */
export const RACE_PLAN_CLOSEOUT_DAYS_AFTER = 2;

export function isInRaceCloseOutWindow(
  raceDateIso: string | Date | null | undefined
): boolean {
  const diff = raceCalendarDaysFromTodayUtc(
    raceDateIso instanceof Date ? raceDateIso.toISOString() : raceDateIso
  );
  if (diff === null) return false;
  if (diff > 0) return false;
  return diff >= -RACE_PLAN_CLOSEOUT_DAYS_AFTER;
}

/** Race was more than close-out days ago — plan should auto-archive. */
export function shouldAutoArchivePlanForRaceDate(
  raceDateIso: string | Date | null | undefined
): boolean {
  const diff = raceCalendarDaysFromTodayUtc(
    raceDateIso instanceof Date ? raceDateIso.toISOString() : raceDateIso
  );
  if (diff === null) return false;
  return diff < -RACE_PLAN_CLOSEOUT_DAYS_AFTER;
}

export function isRaceWeekOrCloser(daysUntilRace: number): boolean {
  return daysUntilRace <= 7;
}

export type PlanBuildMilesSummary = {
  loggedWorkouts: number;
  totalMiles: number;
};

/** Sum logged workout distance on this training plan. */
export async function computePlanBuildMiles(params: {
  planId: string;
  athleteId: string;
}): Promise<PlanBuildMilesSummary> {
  const rows = await prisma.workouts.findMany({
    where: {
      athleteId: params.athleteId,
      planId: params.planId,
      garminDetailActivityId: { not: null },
    },
    select: { actualDistanceMeters: true },
  });
  let totalMeters = 0;
  for (const r of rows) {
    if (r.actualDistanceMeters != null && r.actualDistanceMeters > 0) {
      totalMeters += r.actualDistanceMeters;
    }
  }
  return {
    loggedWorkouts: rows.length,
    totalMiles: Math.round(metersToMiles(totalMeters) * 10) / 10,
  };
}
