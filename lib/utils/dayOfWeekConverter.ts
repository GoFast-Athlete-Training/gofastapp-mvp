/**
 * Day-of-week converter for city_run_setup and city_runs.
 * Canonical storage format: UPPERCASE ("MONDAY", "TUESDAY", ... "SUNDAY").
 * Use when writing to city_run_setups.dayOfWeek and city_runs.dayOfWeek
 * so downstream and filtering are consistent.
 */

export const CANONICAL_DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;
export type CanonicalDayOfWeek = (typeof CANONICAL_DAYS)[number];

const DISPLAY_DAYS: Record<CanonicalDayOfWeek, string> = {
  SUNDAY: 'Sunday',
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
};

/**
 * Normalize any day string to canonical UPPERCASE for storage.
 * Use when writing city_run_setups.dayOfWeek and city_runs.dayOfWeek.
 * Accepts: "Monday", "monday", "MONDAY", "Tue", "Tuesday", etc.
 */
export function toCanonicalDayOfWeek(day: string | null | undefined): string | null {
  if (day == null || String(day).trim() === '') return null;
  const normalized = String(day).trim().toUpperCase();
  if (normalized.length < 2) return null;
  const exact = CANONICAL_DAYS.find((d) => d === normalized);
  if (exact) return exact;
  const byPrefix = CANONICAL_DAYS.find((d) => d.startsWith(normalized) || normalized.startsWith(d));
  return byPrefix ?? null;
}

/**
 * Convert canonical day to display form ("Monday", "Tuesday", ...).
 * Use in APIs if you want to return display format; otherwise consumers
 * (e.g. contentpublic) can format "MONDAY" → "Monday" themselves.
 */
export function toDisplayDayOfWeek(canonical: string | null | undefined): string {
  if (!canonical) return '';
  const key = toCanonicalDayOfWeek(canonical);
  return key ? DISPLAY_DAYS[key as CanonicalDayOfWeek] : canonical;
}

/**
 * Return true if two day values represent the same day (case-insensitive, any format).
 */
export function sameDayOfWeek(a: string | null | undefined, b: string | null | undefined): boolean {
  const ca = toCanonicalDayOfWeek(a);
  const cb = toCanonicalDayOfWeek(b);
  if (ca == null || cb == null) return false;
  return ca === cb;
}
