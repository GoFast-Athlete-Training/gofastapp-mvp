/**
 * Race metadata for planScheduleDayForDateKey — athlete_races snapshot is SOT;
 * fall back to race_registry only when the plan row has no athlete race link.
 */

import { metersToMiles } from "@/lib/pace-utils";

export type PlanRaceScheduleContext = {
  raceDate: Date | null;
  raceName: string | null;
  raceDistanceMiles: number | null;
};

type AthleteRaceSnap = {
  raceDate: Date;
  name: string;
  distanceMeters: number | null;
  distanceLabel?: string | null;
} | null;

type RegistrySnap = {
  raceDate: Date;
  name: string;
  distanceMeters: number | null;
} | null;

function distanceMilesFromMeters(meters: number | null | undefined): number | null {
  if (meters == null || !Number.isFinite(Number(meters))) return null;
  return metersToMiles(Number(meters));
}

/** Resolve race date/name/distance for schedule expansion (matches executePlanGenerate SOT). */
export function planRaceScheduleContextFromPlan(params: {
  athlete_race?: AthleteRaceSnap;
  race_registry?: RegistrySnap;
}): PlanRaceScheduleContext {
  const ar = params.athlete_race;
  if (ar) {
    return {
      raceDate: ar.raceDate,
      raceName: ar.name?.trim() || null,
      raceDistanceMiles: distanceMilesFromMeters(ar.distanceMeters),
    };
  }

  const reg = params.race_registry;
  if (reg) {
    return {
      raceDate: reg.raceDate,
      raceName: reg.name?.trim() || null,
      raceDistanceMiles: distanceMilesFromMeters(reg.distanceMeters),
    };
  }

  return { raceDate: null, raceName: null, raceDistanceMiles: null };
}
