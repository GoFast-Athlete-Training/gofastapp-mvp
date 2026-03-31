/**
 * Pace calculator: parse goal pace or race time, derive training paces.
 * All internal math in seconds per mile; export helpers for seconds per km (for Garmin/API targets).
 */

const MILES_PER_KM = 1 / 1.60934;

/** Seconds per mile → seconds per km */
export function secondsPerMileToSecondsPerKm(secPerMile: number): number {
  return Math.round(secPerMile * 1.60934);
}

/** Parse "7:30" or "7:30/mile" to total seconds per mile */
export function parsePaceToSecondsPerMile(paceString: string): number {
  const match = paceString.trim().match(/(\d+):(\d+)/);
  if (!match) {
    throw new Error(`Invalid pace format: ${paceString}. Use e.g. 7:30 or 7:30/mile`);
  }
  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  return minutes * 60 + seconds;
}

/** Parse race time "H:MM:SS" or "MM:SS" to total seconds */
export function parseRaceTimeToSeconds(timeString: string): number {
  const parts = timeString.trim().split(":").map((p) => parseInt(p, 10));
  if (parts.some((n) => isNaN(n)) || parts.length < 2) {
    throw new Error(`Invalid race time: ${timeString}. Use e.g. 3:30:00 or 22:00`);
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0] * 3600 + parts[1] * 60 + (parts[2] ?? 0);
}

/** Standard race distances in miles (keys lowercased / trimmed) */
export const RACE_DISTANCES_MILES: Record<string, number> = {
  marathon: 26.21875,
  half: 13.109375,
  "half marathon": 13.109375,
  "10k": 6.21371,
  "5k": 3.10686,
  mile: 1,
};

/** Map catalog distance in miles to pace-calculator race key */
export function distanceMilesToPaceRaceKey(distanceMiles: number): string {
  if (distanceMiles >= 25 && distanceMiles <= 27) return "marathon";
  if (distanceMiles >= 12.5 && distanceMiles <= 14) return "half";
  if (distanceMiles >= 6 && distanceMiles <= 6.5) return "10k";
  if (distanceMiles >= 3 && distanceMiles <= 3.2) return "5k";
  if (distanceMiles >= 0.9 && distanceMiles <= 1.1) return "mile";
  if (distanceMiles > 20) return "marathon";
  if (distanceMiles > 10) return "half";
  if (distanceMiles > 5) return "10k";
  if (distanceMiles > 2) return "5k";
  return "5k";
}

/** Derive goal pace (sec/mile) from race finish time and distance */
export function raceTimeToGoalPaceSecondsPerMile(
  raceTimeSeconds: number,
  raceDistance: string
): number {
  const dist = raceDistance.toLowerCase().trim();
  const miles = RACE_DISTANCES_MILES[dist];
  if (!miles) {
    throw new Error(
      `Unknown race distance: ${raceDistance}. Use: marathon, half, 10k, 5k, mile`
    );
  }
  return Math.round(raceTimeSeconds / miles);
}

export type PaceZone =
  | "easy"
  | "longRun"
  | "marathon"
  | "tempo"
  | "interval"
  | "speed"
  | "recovery";

/**
 * Zone offsets from an anchor pace in seconds per mile (often current 5K fitness for plan
 * workouts; may be goal race pace for other flows). Daniels/McMillan style.
 */
const OFFSETS_SEC_PER_MILE: Record<PaceZone, number> = {
  easy: 75,
  longRun: 50,
  marathon: 0,
  tempo: 15,
  interval: -10,
  speed: -20,
  recovery: 75,
};

/** Get seconds per mile for a zone given anchor pace in sec/mile */
export function getPaceSecondsPerMile(
  anchorSecondsPerMile: number,
  zone: PaceZone
): number {
  return Math.max(1, anchorSecondsPerMile + OFFSETS_SEC_PER_MILE[zone]);
}

export interface TrainingPaces {
  /** Anchor pace used for offsets (sec/mile) — e.g. baseline or goal depending on caller */
  goalSecondsPerMile: number;
  /** Per-zone seconds per mile */
  easy: number;
  longRun: number;
  marathon: number;
  tempo: number;
  interval: number;
  speed: number;
  recovery: number;
}

/** Derive all training zone paces from anchor sec/mile (baseline fitness or goal — caller defines). */
export function getTrainingPaces(anchorSecondsPerMile: number): TrainingPaces {
  return {
    goalSecondsPerMile: anchorSecondsPerMile,
    easy: getPaceSecondsPerMile(anchorSecondsPerMile, "easy"),
    longRun: getPaceSecondsPerMile(anchorSecondsPerMile, "longRun"),
    marathon: getPaceSecondsPerMile(anchorSecondsPerMile, "marathon"),
    tempo: getPaceSecondsPerMile(anchorSecondsPerMile, "tempo"),
    interval: getPaceSecondsPerMile(anchorSecondsPerMile, "interval"),
    speed: getPaceSecondsPerMile(anchorSecondsPerMile, "speed"),
    recovery: getPaceSecondsPerMile(anchorSecondsPerMile, "recovery"),
  };
}

/** Tolerance (seconds per km) for pace targets, matching create form */
const PACE_TOLERANCE_SEC_KM = 10;

/** Build PACE target object for API/segment: { type: "PACE", valueLow, valueHigh } in sec/km */
export function paceTargetFromSecondsPerKm(
  secondsPerKm: number,
  toleranceSecKm: number = PACE_TOLERANCE_SEC_KM
): { type: "PACE"; valueLow: number; valueHigh: number } {
  return {
    type: "PACE",
    valueLow: Math.max(1, secondsPerKm - toleranceSecKm),
    valueHigh: secondsPerKm + toleranceSecKm,
  };
}

/** Build PACE target from sec/mile (converts to sec/km and applies tolerance) */
export function paceTargetFromSecondsPerMile(
  secondsPerMile: number,
  toleranceSecKm: number = PACE_TOLERANCE_SEC_KM
): { type: "PACE"; valueLow: number; valueHigh: number } {
  const secKm = secondsPerMileToSecondsPerKm(secondsPerMile);
  return paceTargetFromSecondsPerKm(secKm, toleranceSecKm);
}

/**
 * Format stored PACE target values for UI.
 * Segment `valueLow` / `valueHigh` use the same encoding as the API/Garmin layer
 * (seconds per km via {@link secondsPerMileToSecondsPerKm}).
 */
export function formatStoredPaceAsMinPerMile(storedSecKm: number): string {
  const secPerMile = storedSecKm / 1.60934;
  let totalSec = Math.round(secPerMile);
  let minutes = Math.floor(totalSec / 60);
  let seconds = totalSec % 60;
  if (seconds === 60) {
    minutes += 1;
    seconds = 0;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** Human-readable pace range e.g. "8:15–8:45 /mi" */
export function formatPaceTargetRangeForDisplay(valueLow: number, valueHigh: number): string {
  const lo = formatStoredPaceAsMinPerMile(valueLow);
  const hi = formatStoredPaceAsMinPerMile(valueHigh);
  if (lo === hi) return `${lo} /mi`;
  return `${lo}–${hi} /mi`;
}

/** Single stored pace band value → "m:ss /mi" (same encoding as {@link formatPaceTargetRangeForDisplay}). */
export function formatPaceTargetSingleForDisplay(storedBandValue: number): string {
  return `${formatStoredPaceAsMinPerMile(storedBandValue)} /mi`;
}

/** UI label for segment target rows (sentence case). */
export function workoutTargetTypeLabel(apiType: string): string {
  const t = (apiType || "").toUpperCase();
  if (t === "PACE") return "Pace";
  if (t === "HEART_RATE" || t === "HEARTRATE") return "Heart rate";
  if (t === "CADENCE") return "Cadence";
  if (t === "POWER") return "Power";
  return apiType ? apiType.charAt(0).toUpperCase() + apiType.slice(1).toLowerCase() : "Target";
}

/** Resolve goal pace: either from explicit pace string or from race time + distance */
export function resolveGoalPaceSecondsPerMile(options: {
  goalPace?: string;
  raceTime?: string;
  raceDistance?: string;
}): number {
  const { goalPace, raceTime, raceDistance } = options;
  if (goalPace) {
    return parsePaceToSecondsPerMile(goalPace);
  }
  if (raceTime && raceDistance) {
    const totalSeconds = parseRaceTimeToSeconds(raceTime);
    return raceTimeToGoalPaceSecondsPerMile(totalSeconds, raceDistance);
  }
  throw new Error("Provide either goalPace (e.g. 7:30/mile) or raceTime + raceDistance (e.g. 3:30:00, marathon)");
}
