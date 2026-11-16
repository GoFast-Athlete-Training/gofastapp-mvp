/**
 * Civil calendar day helpers for training plans and races.
 * Reads and week math use YYYY-MM-DD keys — not UTC midnight instants.
 */

import {
  addCalendarDays,
  dateKeyFromDate,
  dateKeyFromIsoOrDateKey,
  dateKeyToUtcNoonDate,
  formatCalendarDate,
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

/**
 * If no preferred training day falls on or after plan start inside that
 * Mon–Sun week, week 1 would have no workouts. Anchor the schedule on the
 * following Monday. An empty preferred-day list means days are not chosen
 * yet, so the start stays put. Do not move the start onto or past race day.
 */
export function scheduleAnchorDayKey(
  planStartDay: string,
  preferredDays: number[],
  raceDay?: string | null
): string {
  const days = [
    ...new Set(preferredDays.filter((d) => Number.isFinite(d) && d >= 1 && d <= 7)),
  ];
  if (days.length === 0) return planStartDay;
  const hasTrainableDay = days.some((dow) => {
    const key = dateKeyForDayInWeek(planStartDay, 1, dow);
    return key >= planStartDay;
  });
  if (hasTrainableDay) return planStartDay;
  const nextMonday = addCalendarDays(mondayKeyOfWeekContaining(planStartDay), 7);
  if (raceDay && nextMonday >= raceDay) return planStartDay;
  return nextMonday;
}

const WEEKDAY_NAMES = [
  "",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export type EmptyFirstWeekNotice = {
  /** Weekday of the chosen start (1=Mon … 7=Sun). The one-off day. */
  oneOffDow: number;
  anchorDay: string;
  anchorLabel: string;
  message: string;
};

/** Friendly note when the start week has no running day left. Null when week 1 can stay. */
export function emptyFirstWeekNotice(input: {
  startDate: string | null | undefined;
  preferredDays: number[];
  raceDate?: string | null;
}): EmptyFirstWeekNotice | null {
  const startDay = normalizeDateKeyInput(input.startDate);
  const preferredCount = input.preferredDays.filter((day) => day >= 1 && day <= 7).length;
  if (!startDay || preferredCount === 0) return null;
  const raceDay = normalizeDateKeyInput(input.raceDate);
  const anchor = scheduleAnchorDayKey(startDay, input.preferredDays, raceDay);
  if (anchor === startDay) return null;
  const oneOffDow = ourDowFromDateKey(startDay);
  const weekOf = formatCalendarDate(startDay, { month: "short", day: "numeric" });
  const anchorWeekday = WEEKDAY_NAMES[ourDowFromDateKey(anchor)] ?? "Monday";
  const anchorLabel = `${anchorWeekday}, ${formatCalendarDate(anchor, { month: "short", day: "numeric" })}`;
  return {
    oneOffDow,
    anchorDay: anchor,
    anchorLabel,
    message: `We noticed there's no running day left in the week of ${weekOf}. Week 1 can start ${anchorLabel}. Want a one-off day this week so you can start now? That's fine too.`,
  };
}

export function parseWeekOneExtraDow(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > 7) return null;
  return n;
}

export function weekOneExtraDowFromCyclePool(data: unknown): number | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  return parseWeekOneExtraDow((data as { weekOneExtraDow?: unknown }).weekOneExtraDow);
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
