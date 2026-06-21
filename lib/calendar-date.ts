/**
 * Universal civil/calendar date helpers for Product.
 *
 * Date-only values are calendar days, not instants. Do not use bare
 * `new Date("YYYY-MM-DD")` or UTC midnight for app calendar-day behavior.
 *
 * - Writes: anchor at UTC noon so the stored instant keeps the intended UTC calendar day.
 * - Display: extract the date key, then render at local noon to avoid TZ rollback.
 * - Comparisons: use stable YYYY-MM-DD keys via dateKeyFromDate / dateKeyFromIsoOrDateKey.
 */

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDateKey(value: string): boolean {
  return DATE_KEY_RE.test(value.trim());
}

/** Stable YYYY-MM-DD from a Date using UTC calendar components. */
export function dateKeyFromDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Extract YYYY-MM-DD from a date key or ISO timestamp. */
export function dateKeyFromIsoOrDateKey(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isDateKey(trimmed)) return trimmed;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return dateKeyFromDate(d);
}

/** Local noon on the civil calendar day — safe for display formatting. */
export function dateKeyToLocalNoonDate(dateKey: string): Date {
  const m = DATE_KEY_RE.exec(dateKey.trim());
  if (!m) throw new Error(`Invalid date key: ${dateKey}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
}

/** UTC start-of-day for range queries (gte/lt day boundaries). */
export function dateKeyToUtcStartOfDay(dateKey: string): Date {
  const m = DATE_KEY_RE.exec(dateKey.trim());
  if (!m) throw new Error(`Invalid date key: ${dateKey}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0));
}

/** UTC noon on the civil calendar day — canonical write anchor for date-only fields. */
export function dateKeyToUtcNoonDate(dateKey: string): Date {
  const m = DATE_KEY_RE.exec(dateKey.trim());
  if (!m) throw new Error(`Invalid date key: ${dateKey}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0));
}

/** Add whole calendar days; returns a YYYY-MM-DD key. */
export function addCalendarDays(dateKeyOrDate: string | Date, days: number): string {
  const key =
    typeof dateKeyOrDate === "string"
      ? dateKeyOrDate.trim()
      : dateKeyFromDate(dateKeyOrDate);

  if (!isDateKey(key)) {
    const resolved =
      typeof dateKeyOrDate === "string"
        ? dateKeyFromIsoOrDateKey(dateKeyOrDate)
        : dateKeyFromDate(dateKeyOrDate);
    if (!resolved) throw new Error(`Invalid date: ${String(dateKeyOrDate)}`);
    return addCalendarDays(resolved, days);
  }

  const anchor = dateKeyToUtcNoonDate(key);
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return dateKeyFromDate(anchor);
}

/** Display a civil date without shifting the calendar day in local timezones. */
export function formatCalendarDate(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  }
): string {
  const key =
    typeof value === "string"
      ? dateKeyFromIsoOrDateKey(value)
      : dateKeyFromDate(value);
  if (!key) {
    return typeof value === "string" ? value : value.toISOString();
  }
  const d = dateKeyToLocalNoonDate(key);
  return d.toLocaleDateString(undefined, options);
}

/**
 * Parse user/API date input for DB writes.
 * Date-only strings normalize to UTC noon; full ISO values normalize to UTC noon of their UTC calendar day.
 */
export function parseCalendarDateForWrite(dateInput: string): Date {
  const s = dateInput.trim();
  if (!s) throw new Error("Invalid date");

  if (isDateKey(s)) {
    return dateKeyToUtcNoonDate(s);
  }

  const key = dateKeyFromIsoOrDateKey(s);
  if (key) {
    return dateKeyToUtcNoonDate(key);
  }

  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date");
  }
  return parsed;
}
