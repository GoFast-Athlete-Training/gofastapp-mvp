/**
 * Deterministic overlay: secondary calendar races adjust the base plan schedule
 * without mutating the shared training_plan_preset.
 */

import { WorkoutType as WT } from "@prisma/client";
import { metersToMiles } from "@/lib/pace-utils";
import { dateForDayInWeek } from "@/lib/training/plan-schedule-dates";
import type { PlanDaySchedule, PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";
import type { PlanRaceEventRow } from "@/lib/training/plan-race-events";
import { utcDateOnly, ymdFromDate } from "@/lib/training/plan-utils";

function ourDowFromUtcDate(d: Date): number {
  const js = utcDateOnly(d).getUTCDay();
  return js === 0 ? 7 : js;
}

function raceDistanceMiles(event: PlanRaceEventRow): number {
  if (event.distanceMeters != null && Number.isFinite(event.distanceMeters)) {
    return metersToMiles(event.distanceMeters);
  }
  return 26.21875;
}

/** Recovery easy days after a secondary race (conservative defaults). */
function recoveryDaysAfterSecondary(distanceMiles: number): number {
  if (distanceMiles >= 20) return 5;
  if (distanceMiles >= 13) return 4;
  if (distanceMiles >= 6) return 3;
  return 2;
}

function findDayPositionForRaceDate(
  planStart: Date,
  totalWeeks: number,
  raceDate: Date
): { weekNumber: number; dow: number } | null {
  const raceUtc = utcDateOnly(raceDate);
  for (let w = 1; w <= totalWeeks; w++) {
    for (let dow = 1; dow <= 7; dow++) {
      const dt = dateForDayInWeek(planStart, w, dow);
      if (utcDateOnly(dt).getTime() === raceUtc.getTime()) {
        return { weekNumber: w, dow };
      }
    }
  }
  return null;
}

function stampPrimaryRaceOnSchedule(
  schedule: PlanWeekSchedule[],
  primaryRaceId: string,
  primaryRaceDate: Date
): void {
  const primaryDow = ourDowFromUtcDate(primaryRaceDate);
  for (const week of schedule) {
    for (const day of week.days) {
      if (day.workoutType === WT.Race) {
        day.raceRegistryId = primaryRaceId;
        day.planRaceEventRole = "PRIMARY";
      }
    }
  }
  // Monday-fold edge: race day may be only entry in week
  void primaryDow;
}

function replaceDayWithSecondaryRace(
  week: PlanWeekSchedule,
  dow: number,
  event: PlanRaceEventRow
): PlanDaySchedule {
  return {
    dow,
    workoutType: WT.Race,
    miles: 0,
    catalogueWorkoutId: null,
    planCycleIndex: null,
    raceRegistryId: event.raceRegistryId,
    planRaceEventRole: "SECONDARY",
    raceName: event.raceName,
  };
}

function removeHardSessionsNearRace(week: PlanWeekSchedule, raceDow: number): void {
  for (const day of week.days) {
    if (day.dow === raceDow) continue;
    const dist = Math.abs(day.dow - raceDow);
    const wrapDist = Math.min(dist, 7 - dist);
    if (wrapDist <= 1 && (day.workoutType === WT.Tempo || day.workoutType === WT.Intervals)) {
      day.workoutType = WT.Easy;
      day.catalogueWorkoutId = null;
      day.planCycleIndex = null;
    }
  }
}

function applyRecoveryAfterRace(
  schedule: PlanWeekSchedule[],
  startWeekNumber: number,
  raceDow: number,
  recoveryCount: number
): void {
  let remaining = recoveryCount;
  for (let wIdx = 0; wIdx < schedule.length && remaining > 0; wIdx++) {
    const week = schedule[wIdx];
    if (week.weekNumber < startWeekNumber) continue;
    for (const day of week.days) {
      if (week.weekNumber === startWeekNumber && day.dow <= raceDow) continue;
      if (day.workoutType === WT.Race && day.planRaceEventRole === "PRIMARY") break;
      if (remaining <= 0) break;
      if (day.workoutType === WT.Tempo || day.workoutType === WT.Intervals) {
        day.workoutType = WT.Easy;
        day.catalogueWorkoutId = null;
        day.planCycleIndex = null;
      }
      day.recoveryAfterRace = true;
      remaining--;
    }
  }
}

export type RaceEventOverlayResult = {
  collisions: Array<{
    raceName: string;
    raceDate: string;
    weekNumber: number;
    replacedWorkoutType: string | null;
  }>;
};

/**
 * Mutates schedule in place. Run after assignWorkoutDays, before volume passes.
 */
export function applyRaceEventOverlay(params: {
  planStart: Date;
  totalWeeks: number;
  schedule: PlanWeekSchedule[];
  primaryRaceId: string;
  primaryRaceDate: Date;
  secondaryEvents: PlanRaceEventRow[];
}): RaceEventOverlayResult {
  const { schedule, secondaryEvents } = params;
  stampPrimaryRaceOnSchedule(schedule, params.primaryRaceId, params.primaryRaceDate);

  const collisions: RaceEventOverlayResult["collisions"] = [];

  const sorted = [...secondaryEvents].sort(
    (a, b) => a.raceDate.getTime() - b.raceDate.getTime()
  );

  for (const event of sorted) {
    const pos = findDayPositionForRaceDate(
      params.planStart,
      params.totalWeeks,
      event.raceDate
    );
    if (!pos) continue;

    const week = schedule.find((w) => w.weekNumber === pos.weekNumber);
    if (!week) continue;

    let existing = week.days.find((d) => d.dow === pos.dow);
    const replacedType = existing?.workoutType ?? null;

    if (existing) {
      if (existing.workoutType === WT.Race && existing.planRaceEventRole === "PRIMARY") {
        continue;
      }
      existing.workoutType = WT.Race;
      existing.miles = 0;
      existing.catalogueWorkoutId = null;
      existing.planCycleIndex = null;
      existing.raceRegistryId = event.raceRegistryId;
      existing.planRaceEventRole = "SECONDARY";
      existing.raceName = event.raceName;
    } else {
      existing = replaceDayWithSecondaryRace(week, pos.dow, event);
      week.days.push(existing);
      week.days.sort((a, b) => a.dow - b.dow);
    }

    collisions.push({
      raceName: event.raceName,
      raceDate: ymdFromDate(event.raceDate),
      weekNumber: pos.weekNumber,
      replacedWorkoutType: replacedType,
    });

    removeHardSessionsNearRace(week, pos.dow);

    const distMi = raceDistanceMiles(event);
    applyRecoveryAfterRace(
      schedule,
      pos.weekNumber,
      pos.dow,
      recoveryDaysAfterSecondary(distMi)
    );
  }

  return { collisions };
}
