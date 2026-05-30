/**
 * Plan mileage aggregates from planSchedule + materialized workouts.
 */

import { prisma } from "@/lib/prisma";
import { metersToMiles } from "@/lib/pace-utils";
import { planScheduleDaysForWeek } from "@/lib/training/plan-schedule";
import { effectiveTrainingWeekCount, localTodayKey, ymdFromDate, utcDateOnly } from "@/lib/training/plan-utils";

const METERS_PER_MILE = 1609.34;

function roundMi(n: number): number {
  return Math.round(n * 10) / 10;
}

export type PlanMileageSnapshot = {
  completedMiles: number;
  plannedToDateMiles: number;
  remainingScheduledMiles: number;
  totalScheduledMiles: number;
  completionPct: number | null;
  underPlanMiles: number | null;
  underPlanMessage: string | null;
  completedWorkouts: number;
  plannedWorkoutsToDate: number;
};

type ScheduledDay = {
  dateKey: string;
  estimatedDistanceInMeters: number;
  workoutType: string;
};

async function loadAllScheduledDays(params: {
  planId: string;
  planStartDate: Date;
  planSchedule: unknown;
  storedTotalWeeks: number;
  raceDate: Date | null;
  raceName: string | null;
  raceDistanceMiles: number | null;
}): Promise<ScheduledDay[]> {
  const effectiveWeeks = effectiveTrainingWeekCount(
    params.planStartDate,
    params.storedTotalWeeks,
    params.raceDate
  );

  const days: ScheduledDay[] = [];
  for (let w = 1; w <= effectiveWeeks; w++) {
    const weekDays = planScheduleDaysForWeek({
      planStartDate: params.planStartDate,
      planSchedule: params.planSchedule,
      weekNumber: w,
      raceDate: params.raceDate,
      raceName: params.raceName,
      raceDistanceMiles: params.raceDistanceMiles,
      totalWeeks: effectiveWeeks,
    });
    for (const d of weekDays) {
      if (String(d.workoutType).toLowerCase() === "rest") continue;
      days.push({
        dateKey: d.dateKey,
        estimatedDistanceInMeters: d.estimatedDistanceInMeters,
        workoutType: d.workoutType,
      });
    }
  }
  return days;
}

export async function loadPlanMileageSnapshot(params: {
  planId: string;
  athleteId: string;
  planStartDate: Date;
  planSchedule: unknown;
  storedTotalWeeks: number;
  raceDate: Date | null;
  raceName: string | null;
  raceDistanceMiles: number | null;
  todayKey?: string;
}): Promise<PlanMileageSnapshot> {
  const todayKey = params.todayKey ?? localTodayKey();
  const scheduled = await loadAllScheduledDays(params);

  let plannedToDateMeters = 0;
  let remainingScheduledMeters = 0;
  let totalScheduledMeters = 0;
  let plannedWorkoutsToDate = 0;

  for (const d of scheduled) {
    const m = d.estimatedDistanceInMeters;
    if (m == null || !Number.isFinite(m) || m <= 0) continue;
    totalScheduledMeters += m;
    if (d.dateKey <= todayKey) {
      plannedToDateMeters += m;
      plannedWorkoutsToDate += 1;
    } else {
      remainingScheduledMeters += m;
    }
  }

  const workouts = await prisma.workouts.findMany({
    where: {
      planId: params.planId,
      athleteId: params.athleteId,
      matchedActivityId: { not: null },
    },
    select: {
      date: true,
      actualDistanceMeters: true,
    },
  });

  let completedMeters = 0;
  let completedWorkouts = 0;
  for (const w of workouts) {
    if (!w.date) continue;
    const key = ymdFromDate(utcDateOnly(w.date));
    if (key > todayKey) continue;
    const m = w.actualDistanceMeters;
    if (m == null || !Number.isFinite(m) || m <= 0) continue;
    completedMeters += m;
    completedWorkouts += 1;
  }

  const completedMiles = roundMi(completedMeters / METERS_PER_MILE);
  const plannedToDateMiles = roundMi(plannedToDateMeters / METERS_PER_MILE);
  const remainingScheduledMiles = roundMi(remainingScheduledMeters / METERS_PER_MILE);
  const totalScheduledMiles = roundMi(totalScheduledMeters / METERS_PER_MILE);

  const completionPct =
    plannedToDateMeters > 0
      ? Math.min(100, Math.round((completedMeters / plannedToDateMeters) * 100))
      : null;

  return {
    completedMiles,
    plannedToDateMiles,
    remainingScheduledMiles,
    totalScheduledMiles,
    completionPct,
    underPlanMiles: null,
    underPlanMessage: null,
    completedWorkouts,
    plannedWorkoutsToDate,
  };
}
