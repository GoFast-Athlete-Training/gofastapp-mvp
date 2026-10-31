/** Standard marathon distance in meters (±1% tolerance). */
export const MARATHON_DISTANCE_METERS = 42_195;
const MARATHON_TOLERANCE = 0.01;

export type RaceDistanceClass = "marathon" | "other";

export type LifecycleHorizonOverrides = {
  trainingCycleDaysBefore?: number;
  deepPrepDaysBefore?: number;
  raceWeekDaysBefore?: number;
};

export const MARATHON_HORIZON_DEFAULTS = {
  trainingCycleDaysBefore: 154,
  deepPrepDaysBefore: 14,
  raceWeekDaysBefore: 7,
};

export const OTHER_HORIZON_DEFAULTS = {
  raceWeekDaysBefore: 7,
};

export function classifyRaceDistance(
  distanceMeters: number | null | undefined,
): RaceDistanceClass {
  if (distanceMeters == null || !Number.isFinite(distanceMeters)) return "other";
  const lo = MARATHON_DISTANCE_METERS * (1 - MARATHON_TOLERANCE);
  const hi = MARATHON_DISTANCE_METERS * (1 + MARATHON_TOLERANCE);
  if (distanceMeters >= lo && distanceMeters <= hi) return "marathon";
  return "other";
}

export function resolveHorizons(
  distanceClass: RaceDistanceClass,
  overrides?: LifecycleHorizonOverrides | null,
) {
  if (distanceClass === "other") {
    return {
      raceWeekDaysBefore:
        overrides?.raceWeekDaysBefore ?? OTHER_HORIZON_DEFAULTS.raceWeekDaysBefore,
    };
  }
  return {
    trainingCycleDaysBefore:
      overrides?.trainingCycleDaysBefore ??
      MARATHON_HORIZON_DEFAULTS.trainingCycleDaysBefore,
    deepPrepDaysBefore:
      overrides?.deepPrepDaysBefore ?? MARATHON_HORIZON_DEFAULTS.deepPrepDaysBefore,
    raceWeekDaysBefore:
      overrides?.raceWeekDaysBefore ?? MARATHON_HORIZON_DEFAULTS.raceWeekDaysBefore,
  };
}

export function parseLifecycleHorizonOverrides(
  raw: unknown,
): LifecycleHorizonOverrides | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const num = (k: string) => {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return Math.round(v);
    return undefined;
  };
  const out: LifecycleHorizonOverrides = {};
  const t = num("trainingCycleDaysBefore");
  const d = num("deepPrepDaysBefore");
  const w = num("raceWeekDaysBefore");
  if (t != null) out.trainingCycleDaysBefore = t;
  if (d != null) out.deepPrepDaysBefore = d;
  if (w != null) out.raceWeekDaysBefore = w;
  return Object.keys(out).length > 0 ? out : null;
}
