/**
 * Riegel-style race projection from current 5K pace — shared by hydrate, web, and mobile.
 */

import { metersToMiles } from "@/lib/pace-utils";
import { parsePaceToSecondsPerMile, parseRaceTimeToSeconds } from "@/lib/workout-generator/pace-calculator";

export const MILES_5K_RIEGEL = 3.10686;

export function parsePaceStringToSecPerMile(pace: string | null | undefined): number | null {
  const raw = pace?.trim();
  if (!raw) return null;
  try {
    const sec = parsePaceToSecondsPerMile(raw);
    return Number.isFinite(sec) && sec > 0 ? sec : null;
  } catch {
    return null;
  }
}

export function formatSecPerMile(sec: number | null | undefined): string | null {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return null;
  const rounded = Math.round(sec);
  const m = Math.floor(rounded / 60);
  const s = rounded % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatFinishClock(totalSec: number): string {
  const rounded = Math.max(0, Math.round(totalSec));
  const h = Math.floor(rounded / 3600);
  const m = Math.floor((rounded % 3600) / 60);
  const s = rounded % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function parseGoalTimeToSeconds(goalTime: string | null | undefined): number | null {
  const raw = goalTime?.trim();
  if (!raw) return null;
  try {
    const sec = parseRaceTimeToSeconds(raw);
    return Number.isFinite(sec) && sec > 0 ? sec : null;
  } catch {
    return null;
  }
}

/** Project race finish + avg pace from current 5K pace (sec/mi) at event distance. */
export function projectRaceFromFiveKSecPerMile(
  fiveKSecPerMile: number,
  eventMiles: number
): {
  projectedFinishSec: number;
  projectedFinish: string;
  projectedPaceSecPerMile: number;
  projectedPace: string;
} | null {
  if (!Number.isFinite(fiveKSecPerMile) || fiveKSecPerMile <= 0) return null;
  if (!Number.isFinite(eventMiles) || eventMiles <= 0) return null;

  const fiveKSec = fiveKSecPerMile * MILES_5K_RIEGEL;
  const projSec = Math.round(fiveKSec * Math.pow(eventMiles / MILES_5K_RIEGEL, 1.06));
  const paceSecPerMile = Math.round(projSec / eventMiles);

  return {
    projectedFinishSec: projSec,
    projectedFinish: formatFinishClock(projSec),
    projectedPaceSecPerMile: paceSecPerMile,
    projectedPace: formatSecPerMile(paceSecPerMile) ?? "",
  };
}

export function projectRaceFromFiveKPaceString(
  fiveKPaceStr: string | null | undefined,
  eventMiles: number
): ReturnType<typeof projectRaceFromFiveKSecPerMile> {
  const sec = parsePaceStringToSecPerMile(fiveKPaceStr);
  if (sec == null) return null;
  return projectRaceFromFiveKSecPerMile(sec, eventMiles);
}

export function raceDistanceMilesFromRegistry(distanceMeters: number | null | undefined): number | null {
  if (distanceMeters == null || !Number.isFinite(Number(distanceMeters))) return null;
  const miles = metersToMiles(Number(distanceMeters));
  return miles > 0 ? miles : null;
}

export type GoalDifference = {
  finishDeltaSec: number | null;
  finishDeltaLabel: string | null;
  paceDeltaSecPerMile: number | null;
  paceDeltaLabel: string | null;
  /** positive = projected faster than goal */
  onTrack: boolean | null;
};

export function differenceToGoal(params: {
  goalFinishSec: number | null;
  projectedFinishSec: number | null;
  goalPaceSecPerMile: number | null;
  projectedPaceSecPerMile: number | null;
}): GoalDifference {
  const { goalFinishSec, projectedFinishSec, goalPaceSecPerMile, projectedPaceSecPerMile } =
    params;

  let finishDeltaSec: number | null = null;
  let finishDeltaLabel: string | null = null;
  if (goalFinishSec != null && projectedFinishSec != null) {
    finishDeltaSec = goalFinishSec - projectedFinishSec;
    const abs = Math.abs(finishDeltaSec);
    const min = Math.floor(abs / 60);
    const sec = abs % 60;
    const clock = min > 0 ? `${min}:${String(sec).padStart(2, "0")}` : `${sec}s`;
    finishDeltaLabel =
      finishDeltaSec > 0
        ? `${clock} ahead of goal`
        : finishDeltaSec < 0
          ? `${clock} behind goal`
          : "On goal pace";
  }

  let paceDeltaSecPerMile: number | null = null;
  let paceDeltaLabel: string | null = null;
  if (goalPaceSecPerMile != null && projectedPaceSecPerMile != null) {
    paceDeltaSecPerMile = goalPaceSecPerMile - projectedPaceSecPerMile;
    const abs = Math.abs(paceDeltaSecPerMile);
    paceDeltaLabel =
      paceDeltaSecPerMile > 0
        ? `${abs}s/mi faster than goal`
        : paceDeltaSecPerMile < 0
          ? `${abs}s/mi slower than goal`
          : "On goal pace";
  }

  const onTrack =
    finishDeltaSec != null
      ? finishDeltaSec >= 0
      : paceDeltaSecPerMile != null
        ? paceDeltaSecPerMile >= 0
        : null;

  return {
    finishDeltaSec,
    finishDeltaLabel,
    paceDeltaSecPerMile,
    paceDeltaLabel,
    onTrack,
  };
}
