/**
 * Date-based race proximity roles — shakeout (race−2), rest (race−1), race (race day).
 * Consumers must not re-implement this policy with nOffset / DOW wrap hacks.
 */

import { dateForDayInWeek } from "@/lib/training/plan-schedule-dates";
import type { PlanDaySchedule, PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";
import { WorkoutType as WT } from "@prisma/client";
import { addDaysUtc, utcDateOnly, ymdFromDate } from "@/lib/training/plan-utils";

export type RaceDayRole = "shakeout" | "rest" | "race";

export type RaceDayWindowDay = { dateKey: string; role: RaceDayRole };

export function raceDayWindow(raceDate: Date): RaceDayWindowDay[] {
  const raceUtc = utcDateOnly(raceDate);
  return [
    { dateKey: ymdFromDate(addDaysUtc(raceUtc, -2)), role: "shakeout" },
    { dateKey: ymdFromDate(addDaysUtc(raceUtc, -1)), role: "rest" },
    { dateKey: ymdFromDate(raceUtc), role: "race" },
  ];
}

export function raceDayRoleOn(raceDate: Date, dateKey: string): RaceDayRole | null {
  const raceUtc = utcDateOnly(raceDate);
  const key = dateKey.trim();
  for (const entry of raceDayWindow(raceUtc)) {
    if (entry.dateKey === key) return entry.role;
  }
  return null;
}

export function isRaceProximityDate(raceDate: Date, dateKey: string): boolean {
  return raceDayRoleOn(raceDate, dateKey) != null;
}

function findWeekDayForDateKey(
  planStart: Date,
  schedule: PlanWeekSchedule[],
  dateKey: string
): { week: PlanWeekSchedule; dayIndex: number } | null {
  for (const week of schedule) {
    for (let i = 0; i < week.days.length; i++) {
      const day = week.days[i]!;
      const dt = dateForDayInWeek(planStart, week.weekNumber, day.dow);
      if (ymdFromDate(dt) === dateKey) {
        return { week, dayIndex: i };
      }
    }
  }
  return null;
}

function findWeekDowForDateKey(
  planStart: Date,
  totalWeeks: number,
  dateKey: string
): { weekNumber: number; dow: number } | null {
  for (let w = 1; w <= totalWeeks; w++) {
    for (let dow = 1; dow <= 7; dow++) {
      const dt = dateForDayInWeek(planStart, w, dow);
      if (ymdFromDate(dt) === dateKey) return { weekNumber: w, dow };
    }
  }
  return null;
}

export type ApplyRaceDayRolesInput = {
  planStart: Date;
  totalWeeks: number;
  schedule: PlanWeekSchedule[];
  raceDate: Date;
  /** Applied to the race-day row (primary/secondary metadata). */
  raceDayPatch?: Partial<PlanDaySchedule>;
};

/** Mutates schedule: enforces shakeout / rest / race roles for one race anchor. */
export function applyRaceDayRolesOnSchedule(input: ApplyRaceDayRolesInput): void {
  const raceUtc = utcDateOnly(input.raceDate);

  for (const { dateKey, role } of raceDayWindow(raceUtc)) {
    const located = findWeekDayForDateKey(input.planStart, input.schedule, dateKey);

    if (role === "rest") {
      if (located) {
        located.week.days.splice(located.dayIndex, 1);
      }
      continue;
    }

    if (role === "shakeout") {
      if (located) {
        const day = located.week.days[located.dayIndex]!;
        day.workoutType = WT.Easy;
        day.miles = 0;
        day.catalogueWorkoutId = null;
        day.planCycleIndex = null;
      } else {
        const pos = findWeekDowForDateKey(input.planStart, input.totalWeeks, dateKey);
        if (pos) {
          const week = input.schedule.find((w) => w.weekNumber === pos.weekNumber);
          if (week) {
            week.days.push({
              dow: pos.dow,
              workoutType: WT.Easy,
              miles: 0,
              catalogueWorkoutId: null,
              planCycleIndex: null,
            });
            week.days.sort((a, b) => a.dow - b.dow);
          }
        }
      }
      continue;
    }

    if (role === "race") {
      const patch = input.raceDayPatch ?? {};
      if (located) {
        Object.assign(located.week.days[located.dayIndex]!, {
          workoutType: WT.Race,
          miles: 0,
          catalogueWorkoutId: null,
          planCycleIndex: null,
          ...patch,
        });
      } else {
        const pos = findWeekDowForDateKey(input.planStart, input.totalWeeks, dateKey);
        if (pos) {
          const week = input.schedule.find((w) => w.weekNumber === pos.weekNumber);
          if (week) {
            week.days.push({
              dow: pos.dow,
              workoutType: WT.Race,
              miles: 0,
              catalogueWorkoutId: null,
              planCycleIndex: null,
              ...patch,
            });
            week.days.sort((a, b) => a.dow - b.dow);
          }
        }
      }
    }
  }

  /** Strip long / quality sessions that collide with the race window. */
  for (const week of input.schedule) {
    for (let i = week.days.length - 1; i >= 0; i--) {
      const day = week.days[i]!;
      const dt = dateForDayInWeek(input.planStart, week.weekNumber, day.dow);
      const role = raceDayRoleOn(raceUtc, ymdFromDate(dt));
      if (role === "rest") {
        week.days.splice(i, 1);
        continue;
      }
      if (
        role === "shakeout" &&
        (day.workoutType === WT.LongRun ||
          day.workoutType === WT.Tempo ||
          day.workoutType === WT.Intervals)
      ) {
        day.workoutType = WT.Easy;
        day.miles = 0;
        day.catalogueWorkoutId = null;
        day.planCycleIndex = null;
      }
    }
  }
}
