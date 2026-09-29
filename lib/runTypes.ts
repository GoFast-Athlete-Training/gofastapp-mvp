/**
 * Venue/terrain type for a run series — matches city_runs.runType in Product.
 *
 * Staff-facing labels: Track · Trail run · Urban run · Park run
 * Stored slugs:        track · trail · neighborhood · park
 */
export const RUN_TYPE_VALUES = ["track", "trail", "neighborhood", "park"] as const;

export type RunTypeValue = (typeof RUN_TYPE_VALUES)[number];

const VALID = new Set<string>(RUN_TYPE_VALUES);

/** Spoken / legacy aliases → canonical slug. */
const ALIASES: Record<string, RunTypeValue> = {
  track: "track",
  "track run": "track",
  "track workout": "track",
  trail: "trail",
  "trail run": "trail",
  neighborhood: "neighborhood",
  "neighborhood run": "neighborhood",
  urban: "neighborhood",
  "urban run": "neighborhood",
  road: "neighborhood",
  "road run": "neighborhood",
  park: "park",
  "park run": "park",
};

export function normalizeRunType(value: unknown): RunTypeValue | null {
  if (value === undefined || value === null || value === "") return null;
  const s = String(value).trim().toLowerCase();
  if (VALID.has(s)) return s as RunTypeValue;
  return ALIASES[s] ?? null;
}

/** AI / legacy clients may still send isTrack=true — map to runType "track". */
export function runTypeFromScheduleFields(fields: {
  runType?: unknown;
  isTrack?: unknown;
}): RunTypeValue | null {
  const fromType = normalizeRunType(fields.runType);
  if (fromType) return fromType;
  if (fields.isTrack === true || fields.isTrack === "true") return "track";
  return null;
}

export function isTrackRun(runType: unknown): boolean {
  return normalizeRunType(runType) === "track";
}

/** Track workouts happen on a loop — no Strava route / map assets. */
export function nullRouteFieldsForTrackRun(runType: unknown): {
  stravaMapUrl: null;
  mapImageUrl: null;
  routePhotos: null;
  routeNeighborhood: null;
} | null {
  if (!isTrackRun(runType)) return null;
  return {
    stravaMapUrl: null,
    mapImageUrl: null,
    routePhotos: null,
    routeNeighborhood: null,
  };
}

/** Human labels shown in staff UI (not stored in DB). */
export const RUN_TYPE_LABELS: Record<RunTypeValue, string> = {
  track: "Track",
  trail: "Trail run",
  neighborhood: "Urban run",
  park: "Park run",
};

/** Group-run pace bands (min/mile). "Various" = all paces welcome — default for club runs. */
export const PACE_OPTIONS = [
  "Various",
  "6:00-6:30",
  "6:30-7:00",
  "7:00-7:30",
  "7:30-8:00",
  "8:00-8:30",
  "8:30-9:00",
  "9:00-9:30",
  "9:30-10:00",
  "10:00-10:30",
  "10:30-11:00",
  "11:00+",
] as const;

export const DEFAULT_PACE_OPTION = "Various";
