/**
 * Empty plan schedule with only the goal race day stamped (week-by-week load path).
 */

import type { PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";
import { stampPhaseOnPlanSchedule } from "@/lib/training/plan-week-phase-key";
import { dateForDayInWeek } from "@/lib/training/plan-schedule-dates";
import { utcDateOnly, ymdFromDate } from "@/lib/training/plan-utils";
import { WorkoutType as WT } from "@prisma/client";

function ourDowFromUtcDate(d: Date): number {
  const js = d.getUTCDay();
  return js === 0 ? 7 : js;
}

export function buildWeekByWeekPlanShellSchedule(params: {
  planStartDate: Date;
  raceDate: Date;
  totalWeeks: number;
  raceDistanceMiles?: number | null;
}): PlanWeekSchedule[] {
  const raceUtc = utcDateOnly(params.raceDate);
  const raceDow = ourDowFromUtcDate(raceUtc);
  const raceMiles =
    params.raceDistanceMiles != null && Number.isFinite(params.raceDistanceMiles)
      ? Math.round(params.raceDistanceMiles * 10) / 10
      : 26.2;

  const weeks: PlanWeekSchedule[] = [];
  for (let weekNumber = 1; weekNumber <= params.totalWeeks; weekNumber++) {
    weeks.push({ weekNumber, days: [] });
  }

  let raceWeekNumber = params.totalWeeks;
  for (let w = 1; w <= params.totalWeeks; w++) {
    const dk = ymdFromDate(dateForDayInWeek(params.planStartDate, w, raceDow));
    if (dk === ymdFromDate(raceUtc)) {
      raceWeekNumber = w;
      break;
    }
  }

  const raceWeek = weeks.find((w) => w.weekNumber === raceWeekNumber);
  if (raceWeek) {
    raceWeek.days.push({
      dow: raceDow,
      workoutType: WT.Race,
      miles: raceMiles,
      catalogueWorkoutId: null,
      planCycleIndex: null,
    });
  }

  return stampPhaseOnPlanSchedule(weeks, params.totalWeeks);
}
