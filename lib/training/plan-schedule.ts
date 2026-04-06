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
import {
  addDaysUtc,
  calendarTrainingWeekCount,
  mondayRaceFoldsIntoPriorPlanWeek,
  mondayUtcOfWeekContaining,
  utcDateOnly,
} from "./plan-utils";
import { nOffsetFromWeekAnchor, phaseForCatalogue } from "./generate-plan";
import { formatPlannedWorkoutTitle } from "./workout-display-title";
import { titleFromLadderIndex } from "./algo-workout-segments";

export type WeekBounds = { weekStart: Date; weekEnd: Date };

export type WeekBoundsOpts = {
  raceDate?: Date | null;
  totalWeeks?: number;
};

export function weekBoundsFromPlan(
  planStartDate: Date,
  weekNumber: number,
  opts?: WeekBoundsOpts
): WeekBounds {
  const firstMonday = mondayUtcOfWeekContaining(planStartDate);
  const weekStart = addDaysUtc(firstMonday, (weekNumber - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);
  if (
    opts?.raceDate &&
    opts.totalWeeks != null &&
    weekNumber === opts.totalWeeks &&
    mondayRaceFoldsIntoPriorPlanWeek(planStartDate, opts.raceDate)
  ) {
    const raceUtc = utcDateOnly(opts.raceDate);
    const nextMon = addDaysUtc(utcDateOnly(weekStart), 7);
    if (nextMon.getTime() === raceUtc.getTime()) {
      const x = new Date(raceUtc);
      x.setUTCHours(23, 59, 59, 999);
      return { weekStart, weekEnd: x };
    }
  }
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

function maxWeekNumberInPlanWeeks(planWeeks: unknown): number {
  if (!planWeeks || !Array.isArray(planWeeks)) return 1;
  let m = 1;
  for (const w of planWeeks) {
    if (!w || typeof w !== "object") continue;
    const n = Number((w as Record<string, unknown>).weekNumber);
    if (Number.isFinite(n)) m = Math.max(m, n);
  }
  return m;
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
  /** Effective training week count; when omitted, uses max week index in planWeeks JSON */
  totalWeeks?: number;
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

  const resolvedTotalWeeks =
    params.totalWeeks ?? maxWeekNumberInPlanWeeks(planWeeks);

  const { weekStart, weekEnd } = weekBoundsFromPlan(
    planStartDate,
    weekNumber,
    {
      raceDate,
      totalWeeks: resolvedTotalWeeks,
    }
  );
  const weekAnchorUtc = utcDateOnly(weekStart);
  const raceUtc = raceDate ? utcDateOnly(raceDate) : null;
  const weekNOffset =
    raceUtc != null ? nOffsetFromWeekAnchor(weekAnchorUtc, raceUtc) : null;

  const tokens = parseScheduleString(entry.schedule);
  const out: PlanScheduleDay[] = [];

  function pushFromTokens(
    tokenList: ReturnType<typeof parseScheduleString>,
    scheduleWeekNum: number,
    displayWeekNum: number
  ) {
    for (const token of tokenList) {
      const ourDow = dayAbbrToOurDow(token.dayAbbr);
      const date = dateForDayInWeek(planStartDate, scheduleWeekNum, ourDow);
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

      const phaseOffset = isRaceDay ? 0 : (weekNOffset ?? 0);
      const nForRow = isRaceDay ? 0 : weekNOffset;

      out.push({
        dateKey: dateKeyUtc(date),
        date,
        title,
        workoutType: token.workoutType,
        weekNumber: displayWeekNum,
        dayAssigned: dayAbbrToDayName(token.dayAbbr),
        planLadderIndex,
        nOffset: nForRow,
        phase: phaseForCatalogue(phaseOffset),
        estimatedDistanceInMeters: estMeters,
      });
    }
  }

  pushFromTokens(tokens, weekNumber, weekNumber);

  const foldNext =
    raceUtc != null &&
    mondayRaceFoldsIntoPriorPlanWeek(planStartDate, raceUtc) &&
    weekNumber === resolvedTotalWeeks;
  if (foldNext) {
    const nextEntry = scheduleEntryForWeek(planWeeks, weekNumber + 1);
    if (nextEntry) {
      const nextTokens = parseScheduleString(nextEntry.schedule);
      pushFromTokens(nextTokens, weekNumber + 1, weekNumber);
    }
  }

  const startKey = dateKeyUtc(weekStart);
  const endKey = dateKeyUtc(utcDateOnly(weekEnd));
  const clipped = out.filter(
    (d) => d.dateKey >= startKey && d.dateKey <= endKey
  );
  const seen = new Set<string>();
  const deduped: PlanScheduleDay[] = [];
  for (const d of clipped.sort((a, b) => a.dateKey.localeCompare(b.dateKey))) {
    if (seen.has(d.dateKey)) continue;
    seen.add(d.dateKey);
    deduped.push(d);
  }
  return deduped;
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
  const raceUtcForCount = params.raceDate
    ? utcDateOnly(params.raceDate)
    : null;
  const totalWeeksForSchedule =
    raceUtcForCount != null
      ? calendarTrainingWeekCount(params.planStartDate, raceUtcForCount)
      : Math.max(1, params.maxWeekNumber ?? fromEntries);
  const maxWeek = Math.max(
    1,
    params.maxWeekNumber ?? fromEntries,
    fromEntries,
    totalWeeksForSchedule
  );

  for (; weekNumber <= maxWeek; weekNumber++) {
    const days = planScheduleDaysForWeek({
      planStartDate: params.planStartDate,
      planWeeks: params.planWeeks,
      weekNumber,
      raceDate: params.raceDate,
      raceName: params.raceName,
      raceDistanceMiles: params.raceDistanceMiles,
      totalWeeks: totalWeeksForSchedule,
    });
    const hit = days.find((d) => d.dateKey === params.dateKey);
    if (hit) return hit;
  }
  return null;
}
