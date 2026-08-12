/**
 * Preview how a calendar race affects an active plan schedule.
 */

import { metersToMiles } from "@/lib/pace-utils";
import { dateForDayInWeek } from "@/lib/training/plan-schedule-dates";
import {
  isStructuredPlanWeek,
  type PlanWeekSchedule,
} from "@/lib/training/plan-schedule-schema";
import type { PlanRaceEventRow } from "@/lib/training/plan-race-events";
import { utcDateOnly, ymdFromDate, currentTrainingWeekNumber } from "@/lib/training/plan-utils";

export type PlanRaceImpactPreview = {
  planId: string;
  raceRegistryId: string;
  raceName: string;
  raceDate: string;
  weekNumber: number;
  collision: {
    hasCollision: boolean;
    existingWorkoutType: string | null;
    replacesLongRun: boolean;
  };
  nearbyChanges: string[];
  recoveryDaysEstimate: number;
};

function findDayInSchedule(
  planStart: Date,
  schedule: PlanWeekSchedule[],
  raceDate: Date
): { weekNumber: number; dow: number; existingType: string | null } | null {
  const raceUtc = utcDateOnly(raceDate);
  for (const week of schedule) {
    for (const day of week.days) {
      const dt = dateForDayInWeek(planStart, week.weekNumber, day.dow);
      if (utcDateOnly(dt).getTime() === raceUtc.getTime()) {
        return {
          weekNumber: week.weekNumber,
          dow: day.dow,
          existingType: day.workoutType,
        };
      }
    }
  }
  return null;
}

function recoveryDaysEstimate(distanceMiles: number): number {
  if (distanceMiles >= 20) return 5;
  if (distanceMiles >= 13) return 4;
  if (distanceMiles >= 6) return 3;
  return 2;
}

export function previewRaceImpactOnPlan(params: {
  planId: string;
  planStart: Date;
  totalWeeks: number;
  planSchedule: unknown;
  event: Pick<PlanRaceEventRow, "raceRegistryId" | "raceName" | "raceDate" | "distanceMeters">;
}): PlanRaceImpactPreview {
  const schedule = Array.isArray(params.planSchedule)
    ? (params.planSchedule.filter(isStructuredPlanWeek) as PlanWeekSchedule[])
    : [];

  const distMi =
    params.event.distanceMeters != null && Number.isFinite(params.event.distanceMeters)
      ? metersToMiles(params.event.distanceMeters)
      : 26.2;

  const weekNumber = currentTrainingWeekNumber(
    params.planStart,
    params.totalWeeks,
    params.event.raceDate
  );

  const hit = findDayInSchedule(params.planStart, schedule, params.event.raceDate);
  const existingType = hit?.existingType ?? null;

  const nearbyChanges: string[] = [];
  if (existingType === "LongRun") {
    nearbyChanges.push("Race replaces your scheduled long run on that day.");
  } else if (existingType === "Tempo" || existingType === "Intervals") {
    nearbyChanges.push(`Race replaces your ${existingType.toLowerCase()} session.`);
  } else if (existingType === "Easy") {
    nearbyChanges.push("Race replaces an easy run on that day.");
  } else if (existingType === "Race") {
    nearbyChanges.push("Race day already on your plan — will align to this calendar race.");
  } else {
    nearbyChanges.push("Race will be added to your plan on that date.");
  }
  nearbyChanges.push("Quality sessions within a day of the race will be reduced.");
  nearbyChanges.push(
    `About ${recoveryDaysEstimate(distMi)} days of lighter training afterward before rebuilding toward your goal race.`
  );

  return {
    planId: params.planId,
    raceRegistryId: params.event.raceRegistryId,
    raceName: params.event.raceName,
    raceDate: ymdFromDate(params.event.raceDate),
    weekNumber,
    collision: {
      hasCollision: existingType != null && existingType !== "Race",
      existingWorkoutType: existingType,
      replacesLongRun: existingType === "LongRun",
    },
    nearbyChanges,
    recoveryDaysEstimate: recoveryDaysEstimate(distMi),
  };
}
