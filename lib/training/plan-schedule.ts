/**
 * Read-only expansion of training_plans.planSchedule JSON:
 * structured `days[]` (canonical) + legacy `{ schedule: string }` rows.
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
import { nOffsetFromWeekAnchor, phaseForCatalogue } from "./plan-utils";
import { formatPlannedWorkoutTitle } from "./workout-display-title";
import { titleFromCycleIndex } from "./algo-workout-segments";
import {
  type PlanWeekSchedule,
  isStructuredPlanWeek,
} from "@/lib/training/plan-schedule-schema";

export type WeekBounds = { weekStart: Date; weekEnd: Date };

export type WeekBoundsOpts = {
  raceDate?: Date | null;
  totalWeeks?: number;
};

const OUR_DOW_TO_NAME = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

function dayAssignedFromOurDow(ourDow: number): string {
  const n = Math.min(7, Math.max(1, ourDow));
  return OUR_DOW_TO_NAME[n - 1]!;
}

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
  dateKey: string;
  date: Date;
  title: string;
  workoutType: WorkoutType;
  weekNumber: number;
  dayAssigned: string;
  planCycleIndex: number | null;
  nOffset: number | null;
  phase: string;
  estimatedDistanceInMeters: number;
  /** Present on structured schedules */
  catalogueWorkoutId?: string | null;
};

function rawWeek(planSchedule: unknown, weekNumber: number): unknown | null {
  if (!planSchedule || !Array.isArray(planSchedule)) return null;
  return (
    planSchedule.find(
      (w) =>
        w &&
        typeof w === "object" &&
        Number((w as Record<string, unknown>).weekNumber) === weekNumber
    ) ?? null
  );
}

function scheduleEntryLegacy(
  planSchedule: unknown,
  weekNumber: number
): { schedule: string } | null {
  const entry = rawWeek(planSchedule, weekNumber) as Record<string, unknown> | null;
  if (!entry || typeof entry.schedule !== "string") return null;
  return { schedule: entry.schedule };
}

function scheduleEntryStructured(
  planSchedule: unknown,
  weekNumber: number
): PlanWeekSchedule | null {
  const entry = rawWeek(planSchedule, weekNumber);
  if (!isStructuredPlanWeek(entry)) return null;
  return entry;
}

function maxWeekNumberInPlanSchedule(planSchedule: unknown): number {
  if (!planSchedule || !Array.isArray(planSchedule)) return 1;
  let m = 1;
  for (const w of planSchedule) {
    if (!w || typeof w !== "object") continue;
    const n = Number((w as Record<string, unknown>).weekNumber);
    if (Number.isFinite(n)) m = Math.max(m, n);
  }
  return m;
}

/**
 * Canonical name; accepts `planSchedule` or legacy `planWeeks` alias.
 */
export function expandWeekSchedule(params: {
  planStartDate: Date;
  planSchedule?: unknown;
  /** @deprecated Alias for planSchedule (older column name). */
  planWeeks?: unknown;
  weekNumber: number;
  raceDate: Date | null;
  raceName: string | null;
  raceDistanceMiles: number | null;
  totalWeeks?: number;
}): PlanScheduleDay[] {
  const planJson = params.planSchedule ?? params.planWeeks ?? null;

  const structured = scheduleEntryStructured(planJson, params.weekNumber);
  if (structured) {
    return expandStructuredDays({ ...params, structured, planJson });
  }

  /** Legacy compact string rows */
  return expandLegacyDays({ ...params, planJson });
}

/** @deprecated Prefer expandWeekSchedule / planSchedule param */
export function planScheduleDaysForWeek(params: {
  planStartDate: Date;
  planWeeks?: unknown;
  planSchedule?: unknown;
  weekNumber: number;
  raceDate: Date | null;
  raceName: string | null;
  raceDistanceMiles: number | null;
  totalWeeks?: number;
}): PlanScheduleDay[] {
  return expandWeekSchedule({
    planStartDate: params.planStartDate,
    planSchedule: params.planSchedule ?? params.planWeeks,
    weekNumber: params.weekNumber,
    raceDate: params.raceDate,
    raceName: params.raceName,
    raceDistanceMiles: params.raceDistanceMiles,
    totalWeeks: params.totalWeeks,
  });
}

function expandStructuredDays(params: {
  planStartDate: Date;
  structured: PlanWeekSchedule;
  planJson: unknown;
  weekNumber: number;
  raceDate: Date | null;
  raceName: string | null;
  raceDistanceMiles: number | null;
  totalWeeks?: number;
}): PlanScheduleDay[] {
  const {
    planStartDate,
    structured,
    planJson,
    weekNumber,
    raceDate,
    raceName,
    raceDistanceMiles,
  } = params;

  const resolvedTotalWeeks =
    params.totalWeeks ?? maxWeekNumberInPlanSchedule(planJson);

  const { weekStart, weekEnd } = weekBoundsFromPlan(planStartDate, weekNumber, {
    raceDate,
    totalWeeks: resolvedTotalWeeks,
  });
  const weekAnchorUtc = utcDateOnly(weekStart);
  const raceUtc = raceDate ? utcDateOnly(raceDate) : null;
  const weekNOffset =
    raceUtc != null ? nOffsetFromWeekAnchor(weekAnchorUtc, raceUtc) : null;

  const sortedDays = [...structured.days].sort((a, b) => a.dow - b.dow);
  const out: PlanScheduleDay[] = [];

  function pushStructuredDay(opts: {
    ourDow: number;
    scheduleWeekNum: number;
    displayWeekNum: number;
    wt: WorkoutType;
    miles: number;
    planCycleIndex: number | null;
    catalogueWorkoutId?: string | null;
  }) {
    const date = dateForDayInWeek(
      planStartDate,
      opts.scheduleWeekNum,
      opts.ourDow
    );
    const estMeters = milesToMeters(opts.miles);

    let title: string;
    let workoutType: WorkoutType = opts.wt;
    let distMeters = estMeters;

    if (
      workoutType === "Race" ||
      (raceUtc != null &&
        utcDateOnly(date).getTime() === raceUtc.getTime() &&
        workoutType === "LongRun")
    ) {
      workoutType = "Race";
      distMeters =
        raceDistanceMiles != null
          ? milesToMeters(raceDistanceMiles)
          : estMeters;
      title = formatPlannedWorkoutTitle("LongRun", distMeters, {
        isRace: true,
        raceName: raceName ?? undefined,
      });
    } else if (workoutType === "Intervals" || workoutType === "Tempo") {
      title =
        titleFromCycleIndex(workoutType, opts.planCycleIndex ?? 0) ??
        formatPlannedWorkoutTitle(workoutType, estMeters);
    } else {
      title = formatPlannedWorkoutTitle(workoutType, estMeters);
    }

    const isRaceRow = workoutType === "Race";
    const phaseOffset = isRaceRow ? 0 : (weekNOffset ?? 0);
    const nForRow = isRaceRow ? 0 : weekNOffset;

    out.push({
      dateKey: dateKeyUtc(date),
      date,
      title,
      workoutType,
      weekNumber: opts.displayWeekNum,
      dayAssigned: dayAssignedFromOurDow(opts.ourDow),
      planCycleIndex: opts.planCycleIndex,
      nOffset: nForRow,
      phase: phaseForCatalogue(phaseOffset, 4),
      estimatedDistanceInMeters: distMeters,
      catalogueWorkoutId: opts.catalogueWorkoutId ?? null,
    });
  }

  for (const d of sortedDays) {
    pushStructuredDay({
      ourDow: d.dow,
      scheduleWeekNum: weekNumber,
      displayWeekNum: weekNumber,
      wt: d.workoutType,
      miles: d.miles,
      planCycleIndex: d.planCycleIndex,
      catalogueWorkoutId: d.catalogueWorkoutId,
    });
  }

  const foldNext =
    raceUtc != null &&
    mondayRaceFoldsIntoPriorPlanWeek(planStartDate, raceUtc) &&
    weekNumber === resolvedTotalWeeks;
  if (foldNext) {
    const next = scheduleEntryStructured(planJson, weekNumber + 1);
    if (next) {
      for (const d of [...next.days].sort((a, b) => a.dow - b.dow)) {
        pushStructuredDay({
          ourDow: d.dow,
          scheduleWeekNum: weekNumber + 1,
          displayWeekNum: weekNumber,
          wt: d.workoutType,
          miles: d.miles,
          planCycleIndex: d.planCycleIndex,
          catalogueWorkoutId: d.catalogueWorkoutId,
        });
      }
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

function expandLegacyDays(params: {
  planStartDate: Date;
  planJson: unknown | null;
  weekNumber: number;
  raceDate: Date | null;
  raceName: string | null;
  raceDistanceMiles: number | null;
  totalWeeks?: number;
}): PlanScheduleDay[] {
  const {
    planStartDate,
    planJson,
    weekNumber,
    raceDate,
    raceName,
    raceDistanceMiles,
  } = params;

  const entry = scheduleEntryLegacy(planJson, weekNumber);
  if (!entry) return [];

  const resolvedTotalWeeks =
    params.totalWeeks ?? maxWeekNumberInPlanSchedule(planJson);

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
      const planCycleIndex =
        token.workoutType === "Intervals" ||
        token.workoutType === "Tempo" ||
        token.workoutType === "LongRun"
          ? (token.cycleIndex ?? null)
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
        title = titleFromCycleIndex(
          token.workoutType,
          token.cycleIndex ?? 0
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
        workoutType: isRaceDay ? "Race" : token.workoutType,
        weekNumber: displayWeekNum,
        dayAssigned: dayAbbrToDayName(token.dayAbbr),
        planCycleIndex,
        nOffset: nForRow,
        phase: phaseForCatalogue(phaseOffset, 4),
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
    const nextEntry = scheduleEntryLegacy(planJson, weekNumber + 1);
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

export function planScheduleDayForDateKey(params: {
  planStartDate: Date;
  planSchedule?: unknown;
  /** @deprecated */
  planWeeks?: unknown;
  raceDate: Date | null;
  raceName: string | null;
  raceDistanceMiles: number | null;
  dateKey: string;
  maxWeekNumber?: number;
}): PlanScheduleDay | null {
  const raw = params.planSchedule ?? params.planWeeks ?? null;
  if (!raw || !Array.isArray(raw)) return null;

  let weekNumber = 1;
  const fromEntries = Math.max(
    0,
    ...raw
      .map((x) =>
        x && typeof x === "object"
          ? Number((x as Record<string, unknown>).weekNumber)
          : NaN
      )
      .filter((n) => Number.isFinite(n))
  );
  const raceUtcForCount = params.raceDate ? utcDateOnly(params.raceDate) : null;
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
    const days = expandWeekSchedule({
      planStartDate: params.planStartDate,
      planSchedule: raw,
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
