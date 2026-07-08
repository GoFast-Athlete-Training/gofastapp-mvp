/** Grace after scheduled start before a same-day run drops from discover lists. */
export const SAME_DAY_RUN_START_GRACE_MS = 30 * 60 * 1000;

export const DEFAULT_RUN_TIMEZONE = 'America/New_York';

export type RunWithStartTime = {
  date: Date;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  timezone?: string | null;
};

function resolveRunTimezone(run: Pick<RunWithStartTime, 'timezone'>): string {
  const tz = run.timezone?.trim();
  return tz || DEFAULT_RUN_TIMEZONE;
}

/** YYYY-MM-DD for a calendar date stored on the run row (UTC date parts). */
export function runCalendarDayKey(run: Pick<RunWithStartTime, 'date'>): string {
  const d = run.date;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD for "today" in the given IANA timezone. */
export function todayKeyInTimezone(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Convert a wall-clock time on a calendar day in `timeZone` to UTC epoch ms.
 * Iteratively corrects using Intl so DST transitions resolve correctly.
 */
export function zonedLocalWallClockToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): number {
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);

  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(new Date(utc));

    const read = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === type)?.value ?? NaN);

    const zYear = read('year');
    const zMonth = read('month');
    const zDay = read('day');
    let zHour = read('hour');
    const zMinute = read('minute');

    // Intl hour12:false may emit 24 for midnight in some engines.
    if (zHour === 24) zHour = 0;

    if (
      zYear === year &&
      zMonth === month &&
      zDay === day &&
      zHour === hour &&
      zMinute === minute
    ) {
      return utc;
    }

    const targetMinutes = hour * 60 + minute;
    const zonedMinutes = zHour * 60 + zMinute;
    const dayDelta =
      Date.UTC(year, month - 1, day) - Date.UTC(zYear, zMonth - 1, zDay);
    const diffMinutes = targetMinutes - zonedMinutes + Math.round(dayDelta / 86_400_000) * 24 * 60;
    utc += diffMinutes * 60_000;
  }

  return utc;
}

/** UTC timestamp for run calendar date + optional start time in the run timezone. */
export function runCalendarStartMs(run: RunWithStartTime): number | null {
  if (run.startTimeHour == null) return null;

  let hour = run.startTimeHour;
  const minute = run.startTimeMinute ?? 0;
  const period = (run.startTimePeriod ?? '').trim().toUpperCase();
  if (period === 'PM' && hour < 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;

  const d = run.date;
  const timeZone = resolveRunTimezone(run);
  return zonedLocalWallClockToUtcMs(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    hour,
    minute,
    timeZone
  );
}

/**
 * Discover freshness: future calendar days always show; same-day runs hide
 * after local start time + grace unless no start time is set (keep visible all day).
 */
export function isRunStillUpcomingForDiscover(
  run: RunWithStartTime,
  now: Date = new Date()
): boolean {
  const timeZone = resolveRunTimezone(run);
  const todayKey = todayKeyInTimezone(now, timeZone);
  const runKey = runCalendarDayKey(run);

  if (runKey > todayKey) {
    return true;
  }

  if (runKey < todayKey) {
    return false;
  }

  const startMs = runCalendarStartMs(run);
  if (startMs == null) {
    return true;
  }

  return now.getTime() <= startMs + SAME_DAY_RUN_START_GRACE_MS;
}
