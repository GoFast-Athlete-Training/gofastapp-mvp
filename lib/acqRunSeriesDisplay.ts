import { generateCitySlugFromParts } from "@/lib/utils/parseAddress";
import {
  resolveScopeCitySlug,
  startTimeToMinutesAfterMidnight,
} from "@/lib/runSeriesScopeKey";

/** Monday-first calendar order for staff-facing series lists. */
const WEEKDAY_SORT_INDEX: Record<string, number> = {
  monday: 0,
  mon: 0,
  tuesday: 1,
  tue: 1,
  tues: 1,
  wednesday: 2,
  wed: 2,
  thursday: 3,
  thu: 3,
  thur: 3,
  thurs: 3,
  friday: 4,
  fri: 4,
  saturday: 5,
  sat: 5,
  sunday: 6,
  sun: 6,
};

/** Calendar order index for weekday sorting (Monday=0 … Sunday=6; unknown=99). */
export function dayOfWeekSortIndex(dayOfWeek: string | null | undefined): number {
  if (!dayOfWeek?.trim()) return 99;
  const key = dayOfWeek.trim().toLowerCase();
  return WEEKDAY_SORT_INDEX[key] ?? 99;
}

/** Sort weekly series Monday → Sunday, then start time, city, slug. */
export function compareSeriesByWeekday<
  T extends {
    dayOfWeek: string;
    slug?: string | null;
    citySlug?: string | null;
    meetUpCity?: string | null;
    meetUpState?: string | null;
    startTimeHour?: number | null;
    startTimeMinute?: number | null;
    startTimePeriod?: string | null;
  },
>(a: T, b: T): number {
  const dayDiff = dayOfWeekSortIndex(a.dayOfWeek) - dayOfWeekSortIndex(b.dayOfWeek);
  if (dayDiff !== 0) return dayDiff;

  const aMins =
    startTimeToMinutesAfterMidnight(a.startTimeHour, a.startTimeMinute, a.startTimePeriod) ?? 9999;
  const bMins =
    startTimeToMinutesAfterMidnight(b.startTimeHour, b.startTimeMinute, b.startTimePeriod) ?? 9999;
  if (aMins !== bMins) return aMins - bMins;

  const aCity = resolveScopeCitySlug(a.citySlug, a.meetUpCity, a.meetUpState);
  const bCity = resolveScopeCitySlug(b.citySlug, b.meetUpCity, b.meetUpState);
  const cityDiff = aCity.localeCompare(bCity);
  if (cityDiff !== 0) return cityDiff;

  return String(a.slug ?? "").localeCompare(String(b.slug ?? ""));
}

export function sortSeriesByWeekday<
  T extends {
    dayOfWeek: string;
    slug?: string | null;
    citySlug?: string | null;
    meetUpCity?: string | null;
    meetUpState?: string | null;
    startTimeHour?: number | null;
    startTimeMinute?: number | null;
    startTimePeriod?: string | null;
  },
>(rows: T[]): T[] {
  return [...rows].sort(compareSeriesByWeekday);
}

/** Format acq_run_series start time for display. */
export function formatSeriesTime(
  hour: number | null | undefined,
  minute: number | null | undefined,
  period: string | null | undefined
): string {
  if (hour == null && minute == null) return "";
  return `${hour ?? "?"}:${String(minute ?? 0).padStart(2, "0")} ${period ?? ""}`.trim();
}

function narrativePeriod(period: string | null | undefined): string {
  if (!period?.trim()) return "";
  return period.trim().toUpperCase() === "PM" ? "p.m." : "a.m.";
}

/** Prose-friendly time for AI-generated descriptions: "6:30 a.m." not "6:30 AM". */
export function formatSeriesTimeNarrative(
  hour: number | null | undefined,
  minute: number | null | undefined,
  period: string | null | undefined
): string {
  if (hour == null && minute == null) return "";
  const p = narrativePeriod(period);
  return `${hour ?? "?"}:${String(minute ?? 0).padStart(2, "0")}${p ? ` ${p}` : ""}`.trim();
}

/** Normalize freeform schedule times like "6:30 AM" to "6:30 a.m." for AI prose context. */
export function normalizeTimeStringNarrative(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm|a\.m\.|p\.m\.)$/i);
  if (!m) return raw.trim();
  const hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  const period = /^p/i.test(m[3]) ? "PM" : "AM";
  return formatSeriesTimeNarrative(hour, minute, period);
}

/** Post-process AI description text to use a.m./p.m. instead of AM/PM. */
export function normalizeNarrativeTimeCasing(text: string): string {
  return text
    .replace(/\b(\d{1,2}:\d{2})\s*AM\b/g, "$1 a.m.")
    .replace(/\b(\d{1,2}:\d{2})\s*PM\b/g, "$1 p.m.");
}

/** Title-case a canonical day enum for labels. */
export function formatDayLabel(dayOfWeek: string): string {
  const lower = dayOfWeek.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Ensure series titles read like "Wednesday Run" not bare weekday names. */
export function normalizeSeriesDisplayName(opts: {
  name?: string | null;
  dayOfWeek: string;
  clubName?: string | null;
}): string {
  const raw = opts.name?.trim();
  if (raw) {
    if (/\brun series$/i.test(raw)) return raw;
    if (/\brun$/i.test(raw)) return raw;
    return `${raw} Run`;
  }
  const day = formatDayLabel(opts.dayOfWeek);
  const club = opts.clubName?.trim();
  if (club) return `${club} ${day} Run`;
  return `${day} Run`;
}

/** Wizard / saved-row label: "{club} {day} Run Series". */
export function formatSeriesRowTitle(opts: {
  name?: string | null;
  dayOfWeek: string;
  clubName?: string | null;
}): string {
  const base = normalizeSeriesDisplayName(opts);
  if (/\brun series$/i.test(base)) return base;
  if (/\brun$/i.test(base)) return `${base} Series`;
  return `${base} Run Series`;
}

/** Derive city slug server-side from meet-up; optional club HQ fallback when meet-up city absent. */
export function deriveCitySlug(opts: {
  meetUpCity?: string | null;
  meetUpState?: string | null;
  clubCitySlug?: string | null;
  clubCity?: string | null;
  clubState?: string | null;
}): string | null {
  const fromMeetUp = generateCitySlugFromParts(
    opts.meetUpCity?.trim() || null,
    opts.meetUpState?.trim() || null
  );
  if (fromMeetUp) return fromMeetUp;
  const clubSlug = opts.clubCitySlug?.trim();
  if (clubSlug) return clubSlug;
  const fromClub = generateCitySlugFromParts(
    opts.clubCity?.trim() || null,
    opts.clubState?.trim() || null
  );
  return fromClub || null;
}

/** @deprecated Use deriveCitySlug */
export const deriveGofastCity = deriveCitySlug;

export type SeriesBuildBlockReason = "publish" | "meetup" | null;

/** Why a series cannot be built yet (null = eligible). Club approval is entity-scoped, not per-series. */
export function seriesBuildBlockReason(opts: {
  syncedToProd: boolean;
  meetUpPoint?: string | null;
}): SeriesBuildBlockReason {
  if (!opts.meetUpPoint?.trim()) return "meetup";
  if (!opts.syncedToProd) return "publish";
  return null;
}

export function seriesBuildBlockMessage(reason: SeriesBuildBlockReason): string {
  switch (reason) {
    case "publish":
      return "Publish to live app first";
    case "meetup":
      return "Add meet-up in club Runs";
    default:
      return "";
  }
}

export type SeriesCleanupStatus = "needs_cleanup" | "ready" | "live";

/** Saved-series cleanup badge for the Runs wizard. */
export function seriesCleanupStatus(row: {
  syncedToProd: boolean;
  meetUpPoint?: string | null;
  startTimeHour?: number | null;
}): SeriesCleanupStatus {
  if (row.syncedToProd) return "live";
  if (!row.meetUpPoint?.trim() || row.startTimeHour == null) return "needs_cleanup";
  return "ready";
}

export function seriesCleanupStatusLabel(status: SeriesCleanupStatus): string {
  switch (status) {
    case "needs_cleanup":
      return "Needs cleanup";
    case "ready":
      return "Ready";
    case "live":
      return "Live";
  }
}

/** Published/synced status for planned series rows. */
export function seriesPublishStatusLabel(syncedToProd: boolean): string {
  return syncedToProd ? "Published" : "Draft";
}

function runInstanceDateSuffix(dateYmd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateYmd.trim());
  if (!m) return "";
  const month = Number(m[2]);
  const day = Number(m[3]);
  return ` (${month}/${day})`;
}

/** Public run instance title: "{club} {weekday} Run (M/D)". */
export function formatRunInstanceTitle(opts: {
  clubName?: string | null;
  dayOfWeek: string;
  dateYmd: string;
  seriesName?: string | null;
}): string {
  const base =
    opts.seriesName?.trim() ||
    normalizeSeriesDisplayName({
      name: null,
      dayOfWeek: opts.dayOfWeek,
      clubName: opts.clubName,
    });
  return `${base}${runInstanceDateSuffix(opts.dateYmd)}`;
}

/** Turn a weekly series name into a public instance title base (no date). */
export function seriesNameToInstanceTitleBase(opts: {
  seriesName?: string | null;
  dayOfWeek: string;
  clubName?: string | null;
  runType?: string | null;
}): string {
  const raw = opts.seriesName?.trim();
  const runType = opts.runType?.trim().toLowerCase();
  let kind = "Run";
  if (runType === "track") kind = "Track Workout";
  else if (runType === "trail") kind = "Trail Run";
  else if (runType === "neighborhood") kind = "Group Run";
  else if (runType === "park") kind = "Park Run";

  if (raw) {
    let base = raw;
    if (/\brun series$/i.test(raw)) {
      base = raw.replace(/\s+series$/i, "").trim();
    }
    if (runType === "track") {
      base = base.replace(/\bRun\b/gi, "Track Workout").replace(/\bTrack Workout Workout\b/gi, "Track Workout");
    }
    return base;
  }
  return normalizeSeriesDisplayName({
    name: null,
    dayOfWeek: opts.dayOfWeek,
    clubName: opts.clubName,
  });
}

/** Default editable instance title for the run builder seed form. */
export function defaultRunInstanceTitle(opts: {
  clubName?: string | null;
  dayOfWeek: string;
  dateYmd: string;
  seriesName?: string | null;
  runType?: string | null;
}): string {
  const base = opts.seriesName?.trim()
    ? seriesNameToInstanceTitleBase({
        seriesName: opts.seriesName,
        dayOfWeek: opts.dayOfWeek,
        clubName: opts.clubName,
        runType: opts.runType,
      })
    : (() => {
        const day = formatDayLabel(opts.dayOfWeek);
        const club = opts.clubName?.trim();
        const runType = opts.runType?.trim().toLowerCase();
        let kind = "Run";
        if (runType === "track") kind = "Track Workout";
        else if (runType === "trail") kind = "Trail Run";
        else if (runType === "neighborhood") kind = "Group Run";
        else if (runType === "park") kind = "Park Run";
        return club ? `${club} ${day} ${kind}` : `${day} ${kind}`;
      })();

  return `${base}${runInstanceDateSuffix(opts.dateYmd)}`;
}
