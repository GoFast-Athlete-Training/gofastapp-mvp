/**
 * Shared City Run time semantics — DB `startsAt` is the clock when set.
 */

import { computeCityRunStartsAt } from '@/lib/city-run/city-run-starts-at-setter';

export const RUN_PAST_BUFFER_MS = 4 * 60 * 60 * 1000;

export type CityRunClockInput = {
  date: Date | string;
  startTimeHour?: number | null;
  startTimeMinute?: number | null;
  startTimePeriod?: string | null;
  timezone?: string | null;
  citySlug?: string | null;
  startsAt?: Date | null;
};

function asDate(dateInput: Date | string): Date {
  return typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
}

/** When the run is considered to have started. */
export function getCityRunStartMs(input: CityRunClockInput): number {
  if (input.startsAt instanceof Date && !Number.isNaN(input.startsAt.getTime())) {
    return input.startsAt.getTime();
  }

  const date = asDate(input.date);
  const { startsAt } = computeCityRunStartsAt({
    date,
    startTimeHour: input.startTimeHour,
    startTimeMinute: input.startTimeMinute,
    startTimePeriod: input.startTimePeriod,
    timezone: input.timezone,
    citySlug: input.citySlug,
  });
  return startsAt.getTime();
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
  const date = asDate(input.date);
  return (
    date.getUTCFullYear() === today.getUTCFullYear() &&
    date.getUTCMonth() === today.getUTCMonth() &&
    date.getUTCDate() === today.getUTCDate()
  );
}

/** Run is live for check-in: today and not yet past+buffer. */
export function isCityRunLiveForCheckin(input: CityRunClockInput, nowMs = Date.now()): boolean {
  if (!isCityRunToday(input, new Date(nowMs))) return false;
  return !isCityRunPast(input, nowMs);
}
