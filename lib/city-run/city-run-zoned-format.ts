import {
  DEFAULT_CITY_RUN_TIMEZONE,
  resolveCityRunTimezone,
} from '@/lib/city-run/city-run-starts-at-setter';
import { zonedLocalWallClockToUtcMs } from '@/lib/run-discover-freshness';

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidIanaTimezone(tz: string): boolean {
  const trimmed = tz.trim();
  if (!trimmed) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return true;
  } catch {
    return false;
  }
}

export function isCalendarDateKey(value: string): boolean {
  return DATE_KEY_RE.test(value.trim());
}

/** Typed YYYY-MM-DD from API body (date key or ISO). */
export function calendarDateKeyFromDateInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (isCalendarDateKey(trimmed)) return trimmed;
  const head = trimmed.includes('T') ? trimmed.split('T')[0]! : trimmed.slice(0, 10);
  if (isCalendarDateKey(head)) return head;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return calendarDateKeyInTimezone(d, 'UTC');
}

/** Civil Y-M-D for a stored instant when read in the event zone. */
export function calendarDateKeyInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function parseCalendarDateKeyParts(key: string): {
  year: number;
  month: number;
  day: number;
} {
  const m = DATE_KEY_RE.exec(key.trim());
  if (!m) throw new Error(`Invalid calendar date key: ${key}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/** Canonical `city_runs.date` anchor: noon wall clock on the civil day in the event zone. */
export function cityRunStorageDateFromCalendarKey(
  calendarDateKey: string,
  timezone: string
): Date {
  const { year, month, day } = parseCalendarDateKeyParts(calendarDateKey);
  const ms = zonedLocalWallClockToUtcMs(year, month, day, 12, 0, timezone);
  return new Date(ms);
}

export function formatCityRunDateInZone(
  dateOrIso: string | Date,
  timezone: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }
): string {
  const tz = timezone?.trim() || DEFAULT_CITY_RUN_TIMEZONE;
  const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
  if (Number.isNaN(d.getTime())) {
    return typeof dateOrIso === 'string' ? dateOrIso : '';
  }
  return d.toLocaleDateString(undefined, { timeZone: tz, ...options });
}

export function formatCityRunStartsAtInZone(
  startsAt: string | Date,
  timezone: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }
): string {
  const tz = timezone?.trim() || DEFAULT_CITY_RUN_TIMEZONE;
  const d = typeof startsAt === 'string' ? new Date(startsAt) : startsAt;
  if (Number.isNaN(d.getTime())) return typeof startsAt === 'string' ? startsAt : '';
  return d.toLocaleString(undefined, { timeZone: tz, ...options });
}

/** Persist civil day anchor + IANA zone without setting `startsAt`. */
export function applyCityRunCalendarAnchorOnly(data: Record<string, unknown>): void {
  const tz = resolveCityRunTimezone({
    timezone: data.timezone as string | null | undefined,
    citySlug: (data.citySlug as string | null | undefined) ?? null,
  });
  const key = resolveCalendarDateKeyForWrite({
    calendarDateKey: data.calendarDateKey as string | null | undefined,
    date: data.date as Date | undefined,
    timezone: tz,
  });
  data.timezone = tz;
  data.date = cityRunStorageDateFromCalendarKey(key, tz);
}

export function resolveCalendarDateKeyForWrite(input: {
  calendarDateKey?: string | null;
  date?: Date;
  timezone?: string | null;
}): string {
  const stated = input.calendarDateKey?.trim();
  if (stated && isCalendarDateKey(stated)) return stated;
  if (input.date && !Number.isNaN(input.date.getTime())) {
    const tz = resolveCityRunTimezone(input);
    return calendarDateKeyInTimezone(input.date, tz);
  }
  throw new Error('calendarDateKey or valid date required');
}
