/**
 * Plan length and calendar-week helpers (Mon–Sun, UTC date-only).
 */

export function utcDateOnly(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export function addDaysUtc(d: Date, days: number): Date {
  const x = utcDateOnly(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function jsDayFromUtc(d: Date): number {
  return utcDateOnly(d).getUTCDay();
}

/** Monday 00:00 UTC of the week that contains `date` (week = Mon–Sun). */
export function mondayUtcOfWeekContaining(date: Date): Date {
  const x = utcDateOnly(date);
  const js = jsDayFromUtc(x);
  const daysBackFromMonday = js === 0 ? 6 : js - 1;
  return addDaysUtc(x, -daysBackFromMonday);
}

/**
 * When true, race day is a Monday (UTC) that starts a new ISO week; we treat it as the
 * final day of the prior training week instead of a standalone Mon–Sun "plan week".
 */
export function mondayRaceFoldsIntoPriorPlanWeek(
  planStart: Date,
  raceDate: Date
): boolean {
  const raceDay = utcDateOnly(raceDate);
  if (raceDay.getUTCDay() !== 1) return false;
  const planStartMon = mondayUtcOfWeekContaining(planStart);
  const raceWeekMon = mondayUtcOfWeekContaining(raceDate);
  return raceWeekMon.getTime() > planStartMon.getTime();
}

/**
 * Inclusive count of Mon–Sun calendar weeks from the week containing plan
 * start through the week containing race day.
 * If the race is a Monday (not in plan-start week), that day is folded into the prior week — not counted as its own week.
 */
export function calendarTrainingWeekCount(planStart: Date, raceDate: Date): number {
  const firstMon = mondayUtcOfWeekContaining(planStart);
  const lastMon = mondayUtcOfWeekContaining(raceDate);
  if (lastMon.getTime() < firstMon.getTime()) {
    return 1;
  }
  const diffDays = Math.round(
    (lastMon.getTime() - firstMon.getTime()) / 86400000
  );
  let count = Math.max(1, diffDays / 7 + 1);
  if (mondayRaceFoldsIntoPriorPlanWeek(planStart, raceDate)) {
    count = Math.max(1, count - 1);
  }
  return count;
}

/**
 * Effective number of training weeks for API/UI when a race is linked (Monday-race fold).
 * Without a race, uses stored `totalWeeks`.
 */
export function effectiveTrainingWeekCount(
  planStart: Date,
  storedTotalWeeks: number,
  raceDate: Date | null | undefined
): number {
  if (raceDate == null) {
    return Math.max(1, storedTotalWeeks);
  }
  return calendarTrainingWeekCount(planStart, raceDate);
}

export function totalWeeksFromDates(planStartDate: Date, raceDate: Date): number {
  return calendarTrainingWeekCount(planStartDate, raceDate);
}

/** Calendar date string from a UTC date-only `Date` (DB / generator). */
export function ymdFromDate(d: Date): string {
  const x = utcDateOnly(d);
  const y = x.getUTCFullYear();
  const m = String(x.getUTCMonth() + 1).padStart(2, "0");
  const day = String(x.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local wall-clock calendar day (browser = user TZ). Use for "today" matching `dateKey` strings. */
export function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Display a plan date string without shifting the calendar day (avoids UTC midnight / local tz bugs).
 * `ymd` is `YYYY-MM-DD` or any value parseable after appending local noon.
 */
export function formatPlanDateDisplay(
  ymdOrIso: string,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  }
): string {
  const raw = ymdOrIso.trim();
  const base =
    raw.length >= 10 && raw[4] === "-" && raw[7] === "-"
      ? raw.slice(0, 10)
      : raw;
  const d = new Date(`${base}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return raw;
  }
  return d.toLocaleDateString(undefined, options);
}

/** preferredDays: 1=Monday .. 7=Sunday */
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function preferredDaysToHuman(days: number[]): string {
  if (!days.length) return "not specified";
  return days
    .map((d) => DAY_NAMES[d === 7 ? 0 : d] ?? String(d))
    .join(", ");
}

export type CalendarWeekRangeLabelOpts = {
  raceDate?: Date | string | null;
  /** Effective last week (e.g. from effectiveTrainingWeekCount) */
  totalWeeks?: number;
};

/** Mon–Sun range for training week index (1-based), UTC calendar alignment. */
export function formatCalendarWeekRangeLabel(
  planStartRaw: Date | string,
  weekNumber: number,
  opts?: CalendarWeekRangeLabelOpts
): string {
  const planStart =
    typeof planStartRaw === "string" ? new Date(planStartRaw) : planStartRaw;
  const firstMonday = mondayUtcOfWeekContaining(planStart);
  const weekMon = addDaysUtc(firstMonday, (weekNumber - 1) * 7);
  let rangeEndDay = addDaysUtc(weekMon, 6);
  if (
    opts?.raceDate != null &&
    opts.totalWeeks != null &&
    weekNumber === opts.totalWeeks
  ) {
    const r =
      typeof opts.raceDate === "string" ? new Date(opts.raceDate) : opts.raceDate;
    const raceUtc = utcDateOnly(r);
    if (
      mondayRaceFoldsIntoPriorPlanWeek(planStart, raceUtc) &&
      utcDateOnly(addDaysUtc(weekMon, 7)).getTime() === raceUtc.getTime()
    ) {
      rangeEndDay = raceUtc;
    }
  }
  const opt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  /** Local display without TZ drift from UTC-midnight Date (see formatPlanDateDisplay). */
  function fmtUtcDay(d: Date, extra: Intl.DateTimeFormatOptions): string {
    const ymd = ymdFromDate(d);
    const anchor = new Date(`${ymd}T12:00:00`);
    return anchor.toLocaleDateString(undefined, { ...opt, ...extra });
  }
  const yMon = weekMon.getUTCFullYear();
  const yEnd = rangeEndDay.getUTCFullYear();
  const left = fmtUtcDay(weekMon, {
    ...(yMon !== yEnd ? { year: "numeric" } : {}),
  });
  const right = fmtUtcDay(rangeEndDay, { year: "numeric" });
  return `${left} – ${right}`;
}

/**
 * 1-based training week index for "today" vs plan start (Mon–Sun weeks, UTC).
 * Clamps to [1, totalWeeks]. Before plan's week 1, returns 1; after last week, returns totalWeeks.
 */
export function currentTrainingWeekNumber(
  planStartRaw: Date | string,
  totalWeeks: number,
  now: Date = new Date()
): number {
  if (!Number.isFinite(totalWeeks) || totalWeeks < 1) {
    return 1;
  }
  const planStart =
    typeof planStartRaw === "string" ? new Date(planStartRaw) : planStartRaw;
  const firstMonday = mondayUtcOfWeekContaining(planStart);
  const thisMonday = mondayUtcOfWeekContaining(now);
  const diffMs = thisMonday.getTime() - firstMonday.getTime();
  const rawWeek = Math.floor(diffMs / (7 * 86400000)) + 1;
  return Math.min(Math.max(rawWeek, 1), totalWeeks);
}

/**
 * 1-based training week index for a calendar day (`YYYY-MM-DD`) vs plan start (Mon–Sun weeks, UTC).
 * Clamps to [1, totalWeeks].
 */
export function trainingWeekNumberForDateKey(
  planStartRaw: Date | string,
  totalWeeks: number,
  dateKey: string
): number {
  const raw = dateKey.trim().slice(0, 10);
  if (raw.length !== 10 || raw[4] !== "-" || raw[7] !== "-") {
    return 1;
  }
  const anchor = new Date(`${raw}T12:00:00Z`);
  if (Number.isNaN(anchor.getTime())) {
    return 1;
  }
  return currentTrainingWeekNumber(planStartRaw, totalWeeks, anchor);
}

