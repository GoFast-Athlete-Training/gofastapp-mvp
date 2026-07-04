/** Grace after scheduled start before a same-day run drops from public discover. */
export const SAME_DAY_RUN_START_GRACE_MS = 30 * 60 * 1000;

export type RunWithStartTime = {
  date: Date;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
};

/** UTC timestamp for run calendar date + optional start time (null if no hour set). */
export function runCalendarStartMs(run: RunWithStartTime): number | null {
  if (run.startTimeHour == null) return null;

  let hour = run.startTimeHour;
  const minute = run.startTimeMinute ?? 0;
  const period = (run.startTimePeriod ?? '').trim().toUpperCase();
  if (period === 'PM' && hour < 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;

  const d = run.date;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, minute, 0, 0);
}

/**
 * Public discover freshness: future calendar days always show; same-day runs hide
 * after start time + grace unless no start time is set (keep visible all day).
 */
export function isRunStillUpcomingForDiscover(
  run: RunWithStartTime,
  now: Date = new Date()
): boolean {
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);

  const runDayStart = new Date(run.date);
  runDayStart.setUTCHours(0, 0, 0, 0);

  if (runDayStart.getTime() > startOfToday.getTime()) {
    return true;
  }

  const startMs = runCalendarStartMs(run);
  if (startMs == null) {
    return true;
  }

  return now.getTime() <= startMs + SAME_DAY_RUN_START_GRACE_MS;
}
