/**
 * Shared City Run time semantics — date-only row + optional start clock.
 * Past = start (or end of civil day) + buffer, not UTC noon + 4h.
 */

export const RUN_PAST_BUFFER_MS = 4 * 60 * 60 * 1000;

export type CityRunClockInput = {
  date: Date | string;
  startTimeHour?: number | null;
  startTimeMinute?: number | null;
  startTimePeriod?: string | null;
  timezone?: string | null;
};

function parseCalendarParts(dateInput: Date | string): { y: number; m: number; d: number } {
  const raw = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return {
    y: raw.getUTCFullYear(),
    m: raw.getUTCMonth(),
    d: raw.getUTCDate(),
  };
}

function hour24(hour: number, period: string | null | undefined): number {
  const p = (period || 'AM').toUpperCase();
  if (p === 'PM' && hour < 12) return hour + 12;
  if (p === 'AM' && hour === 12) return 0;
  return hour;
}

/** When the run is considered to have started (local wall clock approximated via UTC date parts + start time). */
export function getCityRunStartMs(input: CityRunClockInput): number {
  const { y, m, d } = parseCalendarParts(input.date);
  const hour = input.startTimeHour;
  const minute = input.startTimeMinute ?? 0;

  if (hour != null && input.startTimeMinute != null) {
    const h24 = hour24(hour, input.startTimePeriod);
    return Date.UTC(y, m, d, h24, minute, 0, 0);
  }

  // No start time: end of civil day (23:59:59 UTC on stored calendar day)
  return Date.UTC(y, m, d, 23, 59, 59, 999);
}

/** Run is past once start + buffer has elapsed. */
export function isCityRunPast(input: CityRunClockInput, nowMs = Date.now()): boolean {
  return getCityRunStartMs(input) + RUN_PAST_BUFFER_MS < nowMs;
}

/** Within 24h after run became past — for Were you there / post-run CTA. */
export function isCityRunWithinPostRunCheckinWindow(
  input: CityRunClockInput,
  nowMs = Date.now()
): boolean {
  const runPastAt = getCityRunStartMs(input) + RUN_PAST_BUFFER_MS;
  if (nowMs < runPastAt) return false;
  return nowMs - runPastAt <= 24 * 60 * 60 * 1000;
}

/** Run is today on the stored calendar date (UTC civil day). */
export function isCityRunToday(input: CityRunClockInput, today = new Date()): boolean {
  const { y, m, d } = parseCalendarParts(input.date);
  return (
    y === today.getUTCFullYear() &&
    m === today.getUTCMonth() &&
    d === today.getUTCDate()
  );
}

/** Run is live for check-in: today and not yet past+buffer. */
export function isCityRunLiveForCheckin(input: CityRunClockInput, nowMs = Date.now()): boolean {
  if (!isCityRunToday(input, new Date(nowMs))) return false;
  return !isCityRunPast(input, nowMs);
}
