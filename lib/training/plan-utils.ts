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
 * Inclusive count of Mon–Sun calendar weeks from the week containing plan
 * start through the week containing race day.
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
  return Math.max(1, diffDays / 7 + 1);
}

export function totalWeeksFromDates(planStartDate: Date, raceDate: Date): number {
  return calendarTrainingWeekCount(planStartDate, raceDate);
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

/** Mon–Sun range for training week index (1-based), UTC calendar alignment. */
export function formatCalendarWeekRangeLabel(
  planStartRaw: Date | string,
  weekNumber: number
): string {
  const planStart =
    typeof planStartRaw === "string" ? new Date(planStartRaw) : planStartRaw;
  const firstMonday = mondayUtcOfWeekContaining(planStart);
  const weekMon = addDaysUtc(firstMonday, weekNumber - 1);
  const weekSun = addDaysUtc(weekMon, 6);
  const opt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const left = weekMon.toLocaleDateString(undefined, {
    ...opt,
    ...(weekMon.getUTCFullYear() !== weekSun.getUTCFullYear()
      ? { year: "numeric" }
      : {}),
  });
  const right = weekSun.toLocaleDateString(undefined, {
    ...opt,
    year: "numeric",
  });
  return `${left} – ${right}`;
}
