import { dateKeyFromDate } from '@/lib/calendar-date';
import { zonedLocalWallClockToUtcMs } from '@/lib/run-discover-freshness';

/** Product default when the user did not state a zone (DC metro). */
export const DEFAULT_CITY_RUN_TIMEZONE = 'America/New_York';

export type CityRunStartsAtInput = {
  date: Date;
  startTimeHour?: number | null;
  startTimeMinute?: number | null;
  startTimePeriod?: string | null;
  timezone?: string | null;
  citySlug?: string | null;
};

function hour24(hour: number, period: string | null | undefined): number {
  const p = (period || 'AM').toUpperCase();
  if (p === 'PM' && hour < 12) return hour + 12;
  if (p === 'AM' && hour === 12) return 0;
  return hour;
}

/** Resolve IANA zone from payload; never leave null on write. */
export function resolveCityRunTimezone(input: {
  timezone?: string | null;
  citySlug?: string | null;
}): string {
  const stated = input.timezone?.trim();
  if (stated) return stated;
  return DEFAULT_CITY_RUN_TIMEZONE;
}

/**
 * Wall clock on the run's calendar day in the stated timezone → UTC instant for `startsAt`.
 */
export function computeCityRunStartsAt(input: CityRunStartsAtInput): {
  timezone: string;
  startsAt: Date;
} {
  const timezone = resolveCityRunTimezone(input);
  const dateKey = dateKeyFromDate(input.date);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) {
    throw new Error(`Invalid run calendar date: ${input.date.toISOString()}`);
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);

  let hour: number;
  let minute: number;

  if (input.startTimeHour != null) {
    hour = hour24(input.startTimeHour, input.startTimePeriod);
    minute = input.startTimeMinute ?? 0;
  } else {
    hour = 23;
    minute = 59;
  }

  const ms = zonedLocalWallClockToUtcMs(year, month, day, hour, minute, timezone);
  const startsAt = new Date(ms);

  return { timezone, startsAt };
}

/** Stamp `timezone` + `startsAt` on create/update payloads from clock fields. */
export function stampCityRunStartsAtOnWrite<T extends Record<string, unknown>>(
  data: T & CityRunStartsAtInput
): T & { timezone: string; startsAt: Date } {
  const { timezone, startsAt } = computeCityRunStartsAt(data);
  return {
    ...data,
    timezone,
    startsAt,
  };
}
