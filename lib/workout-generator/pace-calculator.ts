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

/** Standard race distances in miles */
const RACE_DISTANCES_MILES: Record<string, number> = {
  marathon: 26.21875,
  half: 13.109375,
  "half marathon": 13.109375,
  "10k": 6.21371,
  "5k": 3.10686,
  mile: 1,
};

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

/** Training pace offsets from goal race pace (seconds per mile). Daniels/McMillan style. */
const OFFSETS_SEC_PER_MILE: Record<PaceZone, number> = {
  easy: 75,
  longRun: 50,
  marathon: 0,
  tempo: 15,
  interval: -10,
  speed: -20,
  recovery: 75,
};

/** Get seconds per mile for a zone given goal pace in sec/mile */
export function getPaceSecondsPerMile(
  goalSecondsPerMile: number,
  zone: PaceZone
): number {
  return Math.max(1, goalSecondsPerMile + OFFSETS_SEC_PER_MILE[zone]);
}

export interface TrainingPaces {
  /** Goal race pace (sec/mile) */
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

/** Derive all training paces from goal pace (sec/mile) */
export function getTrainingPaces(goalSecondsPerMile: number): TrainingPaces {
  return {
    goalSecondsPerMile,
    easy: getPaceSecondsPerMile(goalSecondsPerMile, "easy"),
    longRun: getPaceSecondsPerMile(goalSecondsPerMile, "longRun"),
    marathon: getPaceSecondsPerMile(goalSecondsPerMile, "marathon"),
    tempo: getPaceSecondsPerMile(goalSecondsPerMile, "tempo"),
    interval: getPaceSecondsPerMile(goalSecondsPerMile, "interval"),
    speed: getPaceSecondsPerMile(goalSecondsPerMile, "speed"),
    recovery: getPaceSecondsPerMile(goalSecondsPerMile, "recovery"),
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
