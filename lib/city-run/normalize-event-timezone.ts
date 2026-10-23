export const DEFAULT_EVENT_TIMEZONE = 'America/New_York';

/** Default spreadsheet / staff label (East Coast). */
export const DEFAULT_EVENT_TIMEZONE_STAFF = 'EST';

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

/** Spreadsheet / casual labels → stored zone (DST-aware US cities). */
const EVENT_TIMEZONE_ALIASES: Record<string, string> = {
  eastern: 'America/New_York',
  'eastern time': 'America/New_York',
  'east coast': 'America/New_York',
  et: 'America/New_York',
  est: 'America/New_York',
  edt: 'America/New_York',
  central: 'America/Chicago',
  ct: 'America/Chicago',
  cst: 'America/Chicago',
  cdt: 'America/Chicago',
  mountain: 'America/Denver',
  mt: 'America/Denver',
  mst: 'America/Denver',
  mdt: 'America/Denver',
  pacific: 'America/Los_Angeles',
  pt: 'America/Los_Angeles',
  pst: 'America/Los_Angeles',
  pdt: 'America/Los_Angeles',
};

function aliasKey(raw: string): string {
  return raw.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
}

/** EST, Eastern, America/New_York → canonical id for DB + Intl. */
export function normalizeEventTimezoneInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const aliased = EVENT_TIMEZONE_ALIASES[aliasKey(trimmed)];
  if (aliased) return aliased;
  if (isValidIanaTimezone(trimmed)) return trimmed;
  return trimmed;
}

export function resolveEventTimezoneForWrite(
  raw: string | null | undefined,
  fallback: string = DEFAULT_EVENT_TIMEZONE_STAFF,
): string {
  const trimmed = raw?.trim() ?? '';
  if (trimmed) return normalizeEventTimezoneInput(trimmed);
  const fromFallback = normalizeEventTimezoneInput(fallback);
  if (fromFallback && isValidIanaTimezone(fromFallback)) return fromFallback;
  return DEFAULT_EVENT_TIMEZONE;
}
