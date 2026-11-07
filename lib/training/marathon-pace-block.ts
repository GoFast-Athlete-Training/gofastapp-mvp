import {
  paceTargetFromSecondsPerMile,
  storedPaceSecondsKmToSecondsPerMile,
  type PaceTargetEncodingVersion,
} from "@/lib/workout-generator/pace-calculator";

const PACE_ENC: PaceTargetEncodingVersion = 2;

export function isMarathonPaceWorkBlockTitle(title: string): boolean {
  const t = (title || "").toLowerCase();
  if (t.includes("goal marathon")) return true;
  if (/\bmarathon\s*pace\b/.test(t)) return true;
  if (/\bmp\b/.test(t) && (t.includes("interval") || t.includes("mile") || t.includes("repeat"))) {
    return true;
  }
  return false;
}

/** PACE targets (sec/km storage) centered on goal race pace with standard tolerance band. */
export function mpPaceTargetsFromGoalRaceSecPerMile(goalRacePaceSecPerMile: number): {
  type: "PACE";
  valueLow: number;
  valueHigh: number;
} {
  return paceTargetFromSecondsPerMile(goalRacePaceSecPerMile);
}

export function slotPaceFromGoalRaceBand(goalRacePaceSecPerMile: number): {
  paceValueLow: number;
  paceValueHigh: number;
} {
  const band = mpPaceTargetsFromGoalRaceSecPerMile(goalRacePaceSecPerMile);
  return { paceValueLow: band.valueLow, paceValueHigh: band.valueHigh };
}

export function paceBandSecPerMileFromStoredTarget(
  valueLow: number,
  valueHigh: number
): { low: number; high: number } {
  const low = storedPaceSecondsKmToSecondsPerMile(valueLow, PACE_ENC);
  const high = storedPaceSecondsKmToSecondsPerMile(valueHigh, PACE_ENC);
  return { low: Math.min(low, high), high: Math.max(low, high) };
}
