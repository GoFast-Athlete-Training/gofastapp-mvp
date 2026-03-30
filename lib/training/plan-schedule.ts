/**
 * Read-only view of the plan schedule from `training_plans.planWeeks` JSON.
 * No `workouts` table access — use for week previews.
 */

import type { WorkoutType } from "@prisma/client";
import {
  parseScheduleString,
  dateForDayInWeek,
  dayAbbrToOurDow,
  dayAbbrToDayName,
} from "./schedule-parser";
import { addDaysUtc, mondayUtcOfWeekContaining, utcDateOnly } from "./plan-utils";
import { nOffsetFromWeekAnchor, phaseForCatalogue } from "./generate-plan";
import { formatPlannedWorkoutTitle } from "./workout-display-title";
import { titleFromLadderIndex } from "./algo-workout-segments";

export type WeekBounds = { weekStart: Date; weekEnd: Date };

export function weekBoundsFromPlan(
  planStartDate: Date,
  weekNumber: number
): WeekBounds {
  const firstMonday = mondayUtcOfWeekContaining(planStartDate);
  const weekStart = addDaysUtc(firstMonday, (weekNumber - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
}

export function weekNumberFromPlanDate(planStartDate: Date, date: Date): number {
  const firstMon = mondayUtcOfWeekContaining(planStartDate);
  const d = utcDateOnly(date);
  if (d.getTime() < firstMon.getTime()) return 1;
  const diffDays = Math.floor((d.getTime() - firstMon.getTime()) / 86400000);
  return Math.floor(diffDays / 7) + 1;
}

function milesToMeters(miles: number): number {
  return miles * 1609.34;
}

function dateKeyUtc(d: Date): string {
  return utcDateOnly(d).toISOString().slice(0, 10);
}

export type PlanScheduleDay = {
  /** YYYY-MM-DD UTC for matching workouts + API */
  dateKey: string;
  date: Date;
  title: string;
  workoutType: WorkoutType;
  weekNumber: number;
  dayAssigned: string;
  planLadderIndex: number | null;
  nOffset: number | null;
  phase: string;
  estimatedDistanceInMeters: number;
};

function scheduleEntryForWeek(
  planWeeks: unknown,
  weekNumber: number
): { schedule: string } | null {
  if (!planWeeks || !Array.isArray(planWeeks)) return null;
  const entry = planWeeks.find(
    (w) =>
      w &&
      typeof w === "object" &&
      Number((w as Record<string, unknown>).weekNumber) === weekNumber
  ) as Record<string, unknown> | undefined;
  if (!entry || typeof entry.schedule !== "string") return null;
  return { schedule: entry.schedule };
}

/**
 * Expand one week of `planWeeks` into scheduled days (intent only — no DB).
 */
export function planScheduleDaysForWeek(params: {
  planStartDate: Date;
  planWeeks: unknown;
  weekNumber: number;
  raceDate: Date | null;
  raceName: string | null;
  raceDistanceMiles: number | null;
}): PlanScheduleDay[] {
  const {
    planStartDate,
    planWeeks,
    weekNumber,
    raceDate,
    raceName,
    raceDistanceMiles,
  } = params;

  const entry = scheduleEntryForWeek(planWeeks, weekNumber);
  if (!entry) return [];

  const { weekStart, weekEnd } = weekBoundsFromPlan(planStartDate, weekNumber);
  const weekAnchorUtc = utcDateOnly(weekStart);
  const raceUtc = raceDate ? utcDateOnly(raceDate) : null;
  const weekNOffset =
    raceUtc != null ? nOffsetFromWeekAnchor(weekAnchorUtc, raceUtc) : null;

  const tokens = parseScheduleString(entry.schedule);
  const out: PlanScheduleDay[] = [];

  for (const token of tokens) {
    const ourDow = dayAbbrToOurDow(token.dayAbbr);
    const date = dateForDayInWeek(planStartDate, weekNumber, ourDow);
    const estMeters = milesToMeters(token.miles);
    const planLadderIndex =
      token.workoutType === "Intervals" || token.workoutType === "Tempo"
        ? (token.ladderIndex ?? null)
        : null;

    const isRaceDay =
      raceUtc != null &&
      utcDateOnly(date).getTime() === raceUtc.getTime() &&
      token.workoutType === "LongRun";

    let title: string;
    if (isRaceDay) {
      title = formatPlannedWorkoutTitle(
        "LongRun",
        raceDistanceMiles != null
          ? milesToMeters(raceDistanceMiles)
          : estMeters,
        { isRace: true, raceName: raceName ?? undefined }
      );
    } else if (
      token.workoutType === "Intervals" ||
      token.workoutType === "Tempo"
    ) {
      title = titleFromLadderIndex(
        token.workoutType,
        token.ladderIndex ?? 0
      )!;
    } else {
      title = formatPlannedWorkoutTitle(token.workoutType, estMeters);
    }

    const phaseOffset = weekNOffset ?? 0;

    out.push({
      dateKey: dateKeyUtc(date),
      date,
      title,
      workoutType: token.workoutType,
      weekNumber,
      dayAssigned: dayAbbrToDayName(token.dayAbbr),
      planLadderIndex,
      nOffset: weekNOffset,
      phase: phaseForCatalogue(phaseOffset),
      estimatedDistanceInMeters: estMeters,
    });
  }

  const startKey = dateKeyUtc(weekStart);
  const endKey = dateKeyUtc(utcDateOnly(weekEnd));
  const clipped = out.filter(
    (d) => d.dateKey >= startKey && d.dateKey <= endKey
  );
  clipped.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  return clipped;
}

/**
 * Find the scheduled day for a calendar date, or null if off-plan.
 */
export function planScheduleDayForDateKey(params: {
  planStartDate: Date;
  planWeeks: unknown;
  raceDate: Date | null;
  raceName: string | null;
  raceDistanceMiles: number | null;
  dateKey: string;
  /** When set (e.g. `training_plans.totalWeeks`), caps the search. */
  maxWeekNumber?: number;
}): PlanScheduleDay | null {
  const wn = params.planWeeks;
  if (!wn || !Array.isArray(wn)) return null;

  let weekNumber = 1;
  const fromEntries = Math.max(
    0,
    ...wn
      .map((x) =>
        x && typeof x === "object"
          ? Number((x as Record<string, unknown>).weekNumber)
          : NaN
      )
      .filter((n) => Number.isFinite(n))
  );
  const maxWeek = Math.max(
    1,
    params.maxWeekNumber ?? fromEntries,
    fromEntries
  );

  for (; weekNumber <= maxWeek; weekNumber++) {
    const days = planScheduleDaysForWeek({
      planStartDate: params.planStartDate,
      planWeeks: params.planWeeks,
      weekNumber,
      raceDate: params.raceDate,
      raceName: params.raceName,
      raceDistanceMiles: params.raceDistanceMiles,
    });
    const hit = days.find((d) => d.dateKey === params.dateKey);
    if (hit) return hit;
  }
  return null;
}
