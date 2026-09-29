/**
 * Company acq_run_series helpers: slug pattern + time parsing.
 * Slug is the stable upsert key; Company acq_run_series.id = Product run_series.id when pushed.
 */

import { startTimeToSlugSuffix } from "@/lib/runSeriesScopeKey";

const DAY_MAP: Record<string, string> = {
  monday: "MONDAY",
  mon: "MONDAY",
  tuesday: "TUESDAY",
  tue: "TUESDAY",
  tues: "TUESDAY",
  wednesday: "WEDNESDAY",
  wed: "WEDNESDAY",
  thursday: "THURSDAY",
  thu: "THURSDAY",
  thur: "THURSDAY",
  thurs: "THURSDAY",
  friday: "FRIDAY",
  fri: "FRIDAY",
  saturday: "SATURDAY",
  sat: "SATURDAY",
  sunday: "SUNDAY",
  sun: "SUNDAY",
};

export function toCanonicalDayOfWeek(raw: string): string | null {
  const k = raw.trim().toLowerCase();
  return DAY_MAP[k] ?? (k.length >= 3 ? k.toUpperCase() : null);
}

export function slugifySegment(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/**
 * Display-normalize club / meet-up city text before save (trim, DC variants, light title case).
 */
export function normalizeCity(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim().replace(/\./g, "").replace(/,/g, "").replace(/\s+/g, " ");
  const lower = s.toLowerCase();
  if (
    ["dc", "washington dc", "washington d c", "d c", "district of columbia", "d.c.", "washington, dc"].includes(
      lower
    )
  ) {
    return "Washington DC";
  }
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Map city text to gofast city slug (dc, arlington, …) for lookups and series slugs.
 * Mirrors gofastapp-mvp/lib/seriesSlug.ts — keep in sync.
 */
export function toCitySlug(raw: string | null | undefined): string {
  if (raw == null || !String(raw).trim()) return "unknown";
  const norm = String(raw)
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, " ");

  const aliases: Record<string, string> = {
    dc: "dc",
    dcc: "dc",
    "washington dc": "dc",
    washington: "dc",
    "washington d c": "dc",
    "d c": "dc",
    "district of columbia": "dc",
    arlington: "arlington",
    "arlington va": "arlington",
    alexandria: "alexandria",
    "alexandria va": "alexandria",
    bethesda: "bethesda",
    "bethesda md": "bethesda",
    silver: "silver-spring",
    "silver spring": "silver-spring",
    "silver spring md": "silver-spring",
  };

  return aliases[norm] ?? (slugifySegment(raw) || "unknown");
}

export function isDcState(state: string | null | undefined): boolean {
  const s = (state ?? "").trim().replace(/\./g, "");
  if (!s) return false;
  const upper = s.toUpperCase();
  return upper === "DC" || upper === "D C" || /district of columbia/i.test(s);
}

export function isDcClubLocation(
  city: string | null | undefined,
  state?: string | null | undefined
): boolean {
  return toCitySlug(city) === "dc" || isDcState(state);
}

export type NormalizedClubLocation = {
  city: string | null;
  state: string | null;
  citySlug: string | null;
};

/** Canonical city/state/citySlug for acq_run_clubs HQ (DC → Washington DC + null state). */
export function normalizeClubLocation(
  city: string | null | undefined,
  state?: string | null | undefined
): NormalizedClubLocation {
  if (isDcClubLocation(city, state)) {
    return { city: "Washington DC", state: null, citySlug: "dc" };
  }
  const normalizedCity = normalizeCity(city);
  const slug = normalizedCity ? toCitySlug(normalizedCity) : "unknown";
  return {
    city: normalizedCity,
    state: state?.trim() || null,
    citySlug: slug === "unknown" ? null : slug,
  };
}

const DAY_SLUG_INITIAL: Record<string, string> = {
  MONDAY: "M",
  TUESDAY: "T",
  WEDNESDAY: "W",
  THURSDAY: "Th",
  FRIDAY: "F",
  SATURDAY: "Sa",
  SUNDAY: "Su",
};

function compactClubToken(clubName: string, clubSlug?: string | null): string {
  const raw = clubName.trim() || clubSlug?.replace(/-/g, " ") || "Club";
  const words = raw.replace(/[^a-zA-Z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "Club";
  const lead = words[0][0]?.toUpperCase() ?? "C";
  if (words.length === 1) {
    const w = words[0];
    return lead + w.slice(1);
  }
  const tail = words
    .slice(1)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
  return lead + tail;
}

/** Short city token for series URL suffix (arlington → Arl, dc → Dc). */
export function cityAbbrevFromSlug(citySlug: string | null | undefined): string {
  const slug = (citySlug ?? "").trim().toLowerCase();
  if (!slug || slug === "unknown") return "X";
  const parts = slug.split("-").filter(Boolean);
  if (parts.length === 1) {
    const s = parts[0];
    if (s.length <= 3) return s.charAt(0).toUpperCase() + s.slice(1);
    return s.charAt(0).toUpperCase() + s.slice(1, 3);
  }
  const initials = parts.map((p) => p.charAt(0).toUpperCase()).join("");
  const tail = parts[parts.length - 1];
  return initials + tail.slice(0, Math.min(2, tail.length));
}

export type SeriesSlugTimeParts = {
  startTimeHour?: number | null;
  startTimeMinute?: number | null;
  startTimePeriod?: string | null;
};

/**
 * Compact series slug: `{clubCompact}{dayInitial}Run-{cityAbbrev}[-HHMM]` e.g. BRunawaysWRun-Arl-0630
 * Time suffix distinguishes multiple runs on the same club/day/city.
 */
export function buildSeriesSlug(
  clubName: string,
  clubSlug: string,
  canonicalDay: string,
  cityRaw?: string | null,
  time?: SeriesSlugTimeParts | null
): string {
  const dayKey = canonicalDay.toUpperCase();
  const dayInit = DAY_SLUG_INITIAL[dayKey] ?? dayKey.slice(0, 2);
  const club = compactClubToken(clubName, clubSlug);
  const city = cityAbbrevFromSlug(toCitySlug(cityRaw ?? ""));
  const base = `${club}${dayInit}Run-${city}`;
  const timeSuffix = startTimeToSlugSuffix(
    time?.startTimeHour,
    time?.startTimeMinute,
    time?.startTimePeriod
  );
  return timeSuffix ? `${base}-${timeSuffix}` : base;
}

/** @deprecated Use citySlug — alias for migration reads */
export function legacyGofastCityFromSlug(citySlug: string | null | undefined): string | null {
  return citySlug ?? null;
}

export function parseTimeToParts(
  timeStr: string | undefined | null
): { hour: number; minute: number; period: string } | null {
  if (!timeStr?.trim()) return null;
  const t = timeStr.trim();
  const m = t.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM|am|pm))?/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  let period = (m[3]?.toUpperCase().replace(".", "") as string) || null;
  if (period !== "AM" && period !== "PM") {
    if (hour > 12) {
      hour -= 12;
      period = "PM";
    } else if (hour === 0) {
      hour = 12;
      period = "AM";
    } else if (hour === 12) {
      period = "PM";
    } else {
      period = "AM";
    }
  }
  return { hour, minute, period: period as "AM" | "PM" };
}

export type SeriesStartTimeFormFields = {
  startTimeHour: string;
  startTimeMinute: string;
  startTimePeriod: string;
};

export const EMPTY_SERIES_START_TIME: SeriesStartTimeFormFields = {
  startTimeHour: "",
  startTimeMinute: "",
  startTimePeriod: "AM",
};

export function seriesStartTimeFormFieldsFromParts(
  hour: number | null | undefined,
  minute: number | null | undefined,
  period: string | null | undefined
): SeriesStartTimeFormFields {
  return {
    startTimeHour: hour != null ? String(hour) : "",
    startTimeMinute: minute != null ? String(minute).padStart(2, "0") : "",
    startTimePeriod: period?.trim() || "AM",
  };
}

export function seriesStartTimeFormFieldsFromString(
  timeStr: string | null | undefined
): SeriesStartTimeFormFields {
  const tp = parseTimeToParts(timeStr);
  if (!tp) return { ...EMPTY_SERIES_START_TIME };
  return seriesStartTimeFormFieldsFromParts(tp.hour, tp.minute, tp.period);
}

/** Display string for API payloads and legacy `time` field sync. */
export function formatSeriesStartTimeFromFormFields(
  fields: SeriesStartTimeFormFields
): string {
  const hour = fields.startTimeHour.trim();
  if (!hour) return "";
  const minute = (fields.startTimeMinute.trim() || "00").padStart(2, "0");
  const period = fields.startTimePeriod.trim() || "AM";
  return `${hour}:${minute} ${period}`;
}

export function seriesStartTimePartsFromFormFields(
  fields: SeriesStartTimeFormFields
): { hour: number; minute: number; period: string } | null {
  return parseTimeToParts(formatSeriesStartTimeFromFormFields(fields));
}

/** Parse "3", "around 3", "3 miles", or numeric input to Float miles. */
export function parseMilesInput(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const s = String(raw).trim();
  const m = s.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

const CLUB_NAME_NEIGHBORHOOD_SUFFIXES = [
  /\s+runaways?$/i,
  /\s+run\s+club$/i,
  /\s+running\s+club$/i,
  /\s+runners?$/i,
  /\s+run\s+crew$/i,
  /\s+crew$/i,
  /\s+rc$/i,
];

/** Infer neighborhood from club name, e.g. "The Ballston Runaways" → "Ballston". */
export function inferNeighborhoodFromClubName(clubName: string | null | undefined): string | null {
  if (!clubName?.trim()) return null;
  let s = clubName.trim().replace(/^the\s+/i, "").trim();
  for (const re of CLUB_NAME_NEIGHBORHOOD_SUFFIXES) {
    s = s.replace(re, "").trim();
  }
  if (s.length < 2 || s.length > 48) return null;
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Infer neighborhood from paste patterns like "in Ballston, Arlington, VA". */
export function inferNeighborhoodFromPaste(sourceText: string | null | undefined): string | null {
  if (!sourceText?.trim()) return null;
  const text = sourceText.trim();
  const withState = text.match(
    /\bin\s+([A-Za-z][A-Za-z\s.'-]{1,40}?)(?:,\s*(?:Arlington|Alexandria|Bethesda|Silver Spring|Washington|Fairfax|Rockville|Reston|Herndon|Vienna|McLean|Falls Church|Ballston|Clarendon|Georgetown|Capitol Hill|Brookland|Tenleytown|Chevy Chase|Potomac|Gaithersburg|Leesburg|Manassas|Fredericksburg|Baltimore|Annapolis|Richmond|Boston|Cambridge|Somerville|Brookline|Newton|Arlington|VA|MD|DC|Virginia|Maryland|District of Columbia))/i
  );
  if (withState?.[1]) {
    const n = withState[1].trim().replace(/\s+/g, " ");
    if (n.length >= 2) return n.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  const generic = text.match(/\bin\s+([A-Z][a-zA-Z\s.'-]{2,40})(?:\s|,|\.)/);
  if (generic?.[1]) {
    const n = generic[1].trim().replace(/\s+/g, " ");
    if (n.length >= 2 && n.length <= 48) return n.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return null;
}

/** Fallback route/area when AI omits routeNeighborhood: club meta → club name → paste. */
export function inferRouteNeighborhoodFallback(opts: {
  clubNeighborhood?: string | null;
  clubName?: string | null;
  sourceText?: string | null;
}): string | null {
  const fromClub = opts.clubNeighborhood?.trim();
  if (fromClub) return fromClub;
  const fromName = inferNeighborhoodFromClubName(opts.clubName);
  if (fromName) return fromName;
  return inferNeighborhoodFromPaste(opts.sourceText);
}

/** Confirmed schedule row from the UI (AI does not send city; optional address from Google Places). */
export type ScheduleEntryInput = {
  day: string;
  /** Optional display name; defaults to "{clubName} {Weekday}". */
  seriesName?: string;
  time?: string;
  /** Legacy string miles from AI; parsed to totalMiles on save. */
  miles?: string;
  totalMiles?: number | string;
  routeNeighborhood?: string;
  workoutDescription?: string;
  postRunActivity?: string;
  /** Municipality from Google Places parse → `meetUpCity` (server falls back to club.city when absent). */
  city?: string;
  /** Confirmed Google Places label → `meetUpPoint` (only persisted when `meetUpPlaceId` is set). */
  meetUpPoint?: string;
  /** AI/paste hint only → `seriesRunRawText`; never written to `meetUpPoint` until Places confirms. */
  meetUpHint?: string;
  meetUpState?: string;
  meetUpPlaceId?: string;
  meetUpStreetAddress?: string;
  meetUpLat?: number | string;
  meetUpLng?: number | string;
  /** Venue/terrain — "track" | "trail" | "neighborhood" | "park". */
  runType?: string;
  /** Per-row series description; falls back to club all-runs overview when omitted. */
  description?: string;
  /** @deprecated Use runType "track" instead. Accepted for legacy clients only. */
  isTrack?: boolean;
  /** @deprecated Renamed to `meetUpPoint`. Accepted for legacy clients only. */
  location?: string;
  /** @deprecated Renamed to `meetUpHint`. Accepted for legacy clients only. */
  locationHint?: string;
};

/** Google Places–confirmed label for DB `meetUpPoint`, or null if not confirmed. */
export function resolvedMeetUpPoint(entry: ScheduleEntryInput): string | null {
  const placeId = entry.meetUpPlaceId?.trim();
  const label = (entry.meetUpPoint ?? entry.location)?.trim();
  if (!placeId || !label) return null;
  return label;
}

/** AI/paste hint stored in raw text until staff confirms Places. */
export function resolvedMeetUpHint(entry: ScheduleEntryInput): string | null {
  const hint = (entry.meetUpHint ?? entry.locationHint)?.trim();
  return hint || null;
}

/** Ensure unique slugs within a batch (same day+place collisions). */
export function assignUniqueSlugs(
  clubName: string,
  clubSlug: string,
  entries: ScheduleEntryInput[]
): string[] {
  const used = new Set<string>();
  const scopeUsed = new Set<string>();
  const out: string[] = [];
  for (const e of entries) {
    const canon = toCanonicalDayOfWeek(e.day);
    if (!canon) {
      out.push("");
      continue;
    }
    const tp = parseTimeToParts(e.time);
    const scopeKey = `${canon}|${toCitySlug(e.city)}|${tp ? `${tp.hour}:${tp.minute}${tp.period}` : "notime"}`;
    if (scopeUsed.has(scopeKey)) {
      out.push("");
      continue;
    }
    scopeUsed.add(scopeKey);

    let slug = buildSeriesSlug(clubName, clubSlug, canon, e.city, {
      startTimeHour: tp?.hour ?? null,
      startTimeMinute: tp?.minute ?? null,
      startTimePeriod: tp?.period ?? null,
    });
    let n = 2;
    while (used.has(slug)) {
      slug = `${slug}-${n}`;
      n++;
    }
    used.add(slug);
    out.push(slug);
  }
  return out;
}

/** Pick a slug unique within one club, excluding the current series row. */
export async function uniqueSeriesSlugForClub(
  prismaClient: {
    acq_run_series: {
      findFirst: (args: {
        where: { acqRunClubId: string; slug: string; NOT?: { id: string } };
        select: { id: true };
      }) => Promise<{ id: string } | null>;
    };
  },
  clubId: string,
  baseSlug: string,
  excludeSeriesId: string
): Promise<string> {
  let slug = baseSlug;
  let n = 2;
  while (
    await prismaClient.acq_run_series.findFirst({
      where: { acqRunClubId: clubId, slug, NOT: { id: excludeSeriesId } },
      select: { id: true },
    })
  ) {
    slug = `${baseSlug}-${n}`;
    n++;
  }
  return slug;
}
