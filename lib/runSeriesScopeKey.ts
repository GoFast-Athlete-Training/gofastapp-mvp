import { toCanonicalDayOfWeek, toCitySlug } from "@/lib/acqRunSeries";

export type SeriesScopeFields = {
  clubId: string;
  citySlug?: string | null;
  meetUpCity?: string | null;
  meetUpState?: string | null;
  dayOfWeek: string;
  startTimeHour?: number | null;
  startTimeMinute?: number | null;
  startTimePeriod?: string | null;
};

/** Resolve canonical city slug for series scoping. */
export function resolveScopeCitySlug(
  citySlug?: string | null,
  meetUpCity?: string | null,
  meetUpState?: string | null
): string {
  const fromSlug = citySlug?.trim().toLowerCase();
  if (fromSlug && fromSlug !== "unknown") return fromSlug;
  const fromCity = toCitySlug(meetUpCity);
  if (fromCity !== "unknown") return fromCity;
  if (meetUpState?.trim()) {
    const stateSlug = toCitySlug(meetUpState);
    if (stateSlug !== "unknown") return stateSlug;
  }
  return "unknown";
}

/** Minutes after midnight in local wall-clock (12h AM/PM). Null when no hour set. */
export function startTimeToMinutesAfterMidnight(
  hour: number | null | undefined,
  minute: number | null | undefined,
  period: string | null | undefined
): number | null {
  if (hour == null) return null;
  let h = hour;
  const m = minute ?? 0;
  const p = (period ?? "").trim().toUpperCase();
  if (p === "PM" && h < 12) h += 12;
  if (p === "AM" && h === 12) h = 0;
  if (!p && h >= 24) return null;
  return h * 60 + m;
}

/** Compact HHMM for slug suffix (24h), e.g. 6:30 AM → 0630. */
export function startTimeToSlugSuffix(
  hour: number | null | undefined,
  minute: number | null | undefined,
  period: string | null | undefined
): string | null {
  const mins = startTimeToMinutesAfterMidnight(hour, minute, period);
  if (mins == null) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}`;
}

/**
 * Canonical identity for a recurring series within a club:
 * club + city + weekday + start time (when set).
 */
export function buildSeriesScopeKey(fields: SeriesScopeFields): string {
  const clubId = fields.clubId.trim();
  const day = toCanonicalDayOfWeek(fields.dayOfWeek) ?? fields.dayOfWeek.trim().toUpperCase();
  const city = resolveScopeCitySlug(fields.citySlug, fields.meetUpCity, fields.meetUpState);
  const timeMins = startTimeToMinutesAfterMidnight(
    fields.startTimeHour,
    fields.startTimeMinute,
    fields.startTimePeriod
  );
  const timePart = timeMins == null ? "notime" : String(timeMins);
  return `${clubId}|${city}|${day}|${timePart}`;
}

export type SeriesScopeDuplicateGroup<T> = {
  scopeKey: string;
  rows: T[];
  isDuplicate: boolean;
};

/** Group series rows by scope key; groups with 2+ rows are duplicate candidates. */
export function groupSeriesByScopeKey<T extends SeriesScopeFields>(
  rows: T[]
): SeriesScopeDuplicateGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = buildSeriesScopeKey(row);
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([scopeKey, grouped]) => ({
      scopeKey,
      rows: grouped,
      isDuplicate: grouped.length > 1,
    }));
}

export function findDuplicateScopeGroups<T extends SeriesScopeFields>(
  rows: T[]
): SeriesScopeDuplicateGroup<T>[] {
  return groupSeriesByScopeKey(rows).filter((g) => g.isDuplicate);
}
