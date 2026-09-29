/**
 * Next occurrence of a weekday (e.g. for "next week" run seeding UI).
 * Calendar helpers for run-instance UI (next occurrence of a weekday, etc.).
 */

import { localCalendarYmd } from "./date-local";

const DAY_NAME_TO_INDEX: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

/**
 * Get next occurrence of a weekday from schedule (e.g. "Monday", "Mon").
 * Returns YYYY-MM-DD string. If today is that day, returns next week's occurrence.
 */
export function getNextOccurrenceOfDay(dayName: string | null | undefined): string | null {
  if (!dayName?.trim()) return null;
  const key = dayName.trim().toLowerCase();
  const dayIndex = DAY_NAME_TO_INDEX[key];
  if (dayIndex === undefined) return null;

  const today = new Date();
  const currentDay = today.getDay();
  let daysUntilNext = (dayIndex - currentDay + 7) % 7;
  if (daysUntilNext === 0) daysUntilNext = 7;

  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysUntilNext);
  return localCalendarYmd(nextDate);
}

/** Resolve weekday name/enum to JS day index (0=Sun … 6=Sat). */
export function dayNameToIndex(dayName: string | null | undefined): number | null {
  if (!dayName?.trim()) return null;
  const key = dayName.trim().toLowerCase();
  const idx = DAY_NAME_TO_INDEX[key];
  return idx === undefined ? null : idx;
}

/**
 * Next calendar date for a series weekday, including today when it matches.
 * e.g. on Wednesday, a Wednesday series defaults to today; Saturday → upcoming Saturday.
 */
export function getNextOrTodayOccurrenceOfDay(
  dayName: string | null | undefined,
  fromDate: Date = new Date()
): string | null {
  if (!dayName?.trim()) return null;
  const dayIndex = dayNameToIndex(dayName);
  if (dayIndex === null) return null;

  const currentDay = fromDate.getDay();
  const daysUntil = (dayIndex - currentDay + 7) % 7;
  const target = new Date(fromDate);
  target.setDate(fromDate.getDate() + daysUntil);
  return localCalendarYmd(target);
}

/** True when YYYY-MM-DD falls on the given weekday name/enum. */
export function dateMatchesDayOfWeek(
  ymd: string,
  dayName: string | null | undefined
): boolean {
  const dayIndex = dayNameToIndex(dayName);
  if (dayIndex === null || !/^\d{4}-\d{2}-\d{2}$/.test(ymd.trim())) return false;
  const [y, mo, d] = ymd.trim().split("-").map(Number);
  const dt = new Date(y, mo - 1, d);
  if (Number.isNaN(dt.getTime())) return false;
  return dt.getDay() === dayIndex;
}
