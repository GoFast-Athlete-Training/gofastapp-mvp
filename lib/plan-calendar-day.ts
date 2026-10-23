/**
 * Civil calendar day helpers for training plans and races.
 * Reads and week math use YYYY-MM-DD keys — not UTC midnight instants.
 */

import {
  addCalendarDays,
  dateKeyFromDate,
  dateKeyFromIsoOrDateKey,
  dateKeyToUtcNoonDate,
  isDateKey,
} from "@/lib/calendar-date";
import { DEFAULT_CITY_RUN_TIMEZONE } from "@/lib/city-run/city-run-starts-at-setter";

/** Product default for server-side "today" on plan/race cron and guards. */
export const PRODUCT_CALENDAR_TIMEZONE = DEFAULT_CITY_RUN_TIMEZONE;

const DATE_KEY_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Normalize API / date-input to YYYY-MM-DD or null. */
export function normalizeDateKeyInput(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (isDateKey(s)) return s;
  const key = dateKeyFromIsoOrDateKey(s);
  if (key && isDateKey(key)) return key;
  return null;
}

/** Civil today in product timezone (en-CA → YYYY-MM-DD). */
export function productTodayKey(
  now: Date = new Date(),
  timeZone: string = PRODUCT_CALENDAR_TIMEZONE
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function dateAnchorFromDayKey(dayKey: string): Date {
  return dateKeyToUtcNoonDate(dayKey);
}

export function resolveRaceDayKey(row: {
  raceDay?: string | null;
  raceDate: Date;
}): string {
  const stamped = row.raceDay?.trim();
  if (stamped && isDateKey(stamped)) return stamped;
  return dateKeyFromDate(row.raceDate);
}

export function resolveStartDayKey(row: {
  startDay?: string | null;
  startDate: Date;
}): string {
  const stamped = row.startDay?.trim();
  if (stamped && isDateKey(stamped)) return stamped;
  return dateKeyFromDate(row.startDate);
}

export function resolvePlanDayKey(row: {
  planDay?: string | null;
  date: Date;
}): string {
  const stamped = row.planDay?.trim();
  if (stamped && isDateKey(stamped)) return stamped;
  return dateKeyFromDate(row.date);
}

/** Training convention: 1=Monday … 7=Sunday */
export function ourDowFromDateKey(dateKey: string): number {
  const js = dateKeyToUtcNoonDate(dateKey).getUTCDay();
  return js === 0 ? 7 : js;
}

/** Monday calendar key of the week containing `dateKey` (Mon–Sun weeks). */
export function mondayKeyOfWeekContaining(dateKey: string): string {
  const js = dateKeyToUtcNoonDate(dateKey).getUTCDay();
  const daysBackFromMonday = js === 0 ? 6 : js - 1;
  return addCalendarDays(dateKey, -daysBackFromMonday);
}

export function mondayRaceFoldsIntoPriorPlanWeekKey(
  planStartDay: string,
  raceDay: string
): boolean {
  if (ourDowFromDateKey(raceDay) !== 1) return false;
  const planStartMon = mondayKeyOfWeekContaining(planStartDay);
  const raceWeekMon = mondayKeyOfWeekContaining(raceDay);
  return raceWeekMon > planStartMon;
}

/**
 * Inclusive Mon–Sun week count from plan start through race week.
 * Monday race (not in start week) folds into prior training week.
 */
export function calendarTrainingWeekCountFromKeys(
  planStartDay: string,
  raceDay: string
): number {
  const firstMon = mondayKeyOfWeekContaining(planStartDay);
  const lastMon = mondayKeyOfWeekContaining(raceDay);
  if (lastMon < firstMon) return 1;

  const diffDays = Math.round(
    (dateKeyToUtcNoonDate(lastMon).getTime() -
      dateKeyToUtcNoonDate(firstMon).getTime()) /
      86400000
  );
  let count = Math.max(1, diffDays / 7 + 1);
  if (mondayRaceFoldsIntoPriorPlanWeekKey(planStartDay, raceDay)) {
    count = Math.max(1, count - 1);
  }
  return count;
}

export function totalWeeksFromDayKeys(planStartDay: string, raceDay: string): number {
  return calendarTrainingWeekCountFromKeys(planStartDay, raceDay);
}

/**
 * Week N = Nth Mon–Sun block from the Monday of the week containing plan start.
 */
export function dateKeyForDayInWeek(
  planStartDay: string,
  weekNumber: number,
  ourDow: number
): string {
  const firstMonday = mondayKeyOfWeekContaining(planStartDay);
  const weekMonday = addCalendarDays(firstMonday, (weekNumber - 1) * 7);
  const targetJs = ourDow === 7 ? 0 : ourDow;
  for (let d = 0; d < 7; d++) {
    const candidate = addCalendarDays(weekMonday, d);
    if (dateKeyToUtcNoonDate(candidate).getUTCDay() === targetJs) {
      return candidate;
    }
  }
  throw new Error(`Could not place day ${ourDow} in calendar week`);
}

export function raceCalendarBeforeProductToday(raceDay: string): boolean {
  return raceDay < productTodayKey();
}

export function raceCalendarOnOrBeforeProductToday(raceDay: string): boolean {
  return raceDay <= productTodayKey();
}

export function raceCalendarAfterProductToday(raceDay: string): boolean {
  return raceDay > productTodayKey();
}

/** Stamp pair for DB writes: civil key + UTC noon anchor. */
export function calendarDayWritePair(dayKey: string): {
  dayKey: string;
  anchor: Date;
} {
  if (!DATE_KEY_ONLY.test(dayKey)) {
    throw new Error(`Invalid calendar day: ${dayKey}`);
  }
  return { dayKey, anchor: dateKeyToUtcNoonDate(dayKey) };
}

export function triggerDayKeysFromRaceDay(raceDay: string): {
  raceDay: string;
  weekOutDay: string;
  reminderDay: string;
} {
  return {
    raceDay,
    weekOutDay: addCalendarDays(raceDay, -7),
    reminderDay: addCalendarDays(raceDay, -1),
  };
}
