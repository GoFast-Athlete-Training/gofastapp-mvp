/**
 * Resolve goal-race distance for plan generation — athlete snapshot → registry → label/name infer.
 * Persists confirmed meters on athlete_races when resolved but not yet stored.
 */

import { updateAthleteRaceDistance } from "@/lib/athlete-races-service";
import { metersForCanonicalDistanceLabel } from "@/lib/training/race-distance-infer";
import { raceDistanceForPresetMatch } from "@/lib/training/preset-distance-match";
import { inferDistanceLabelFromRaceName } from "@/lib/training/race-distance-infer";

export type GoalRaceMetersInput = {
  id: string;
  name: string;
  distanceMeters: number | null;
  distanceLabel: string | null;
  race_registry?: {
    distanceMeters: number | null;
    distanceLabel: string | null;
  } | null;
};

export function resolveGoalRaceMetersInput(race: GoalRaceMetersInput): {
  meters: number | null;
  label: string | null;
} {
  const registry = race.race_registry;
  const labelFallback =
    race.distanceLabel ??
    registry?.distanceLabel ??
    inferDistanceLabelFromRaceName(race.name) ??
    null;
  const resolved = raceDistanceForPresetMatch({
    athleteRaceMeters: race.distanceMeters,
    registryMeters: registry?.distanceMeters ?? null,
    distanceLabel: labelFallback,
  });
  let meters = resolved.meters;
  const label = resolved.label ?? labelFallback;
  if ((meters == null || meters <= 0) && label) {
    const fromLabel = metersForCanonicalDistanceLabel(label);
    if (fromLabel != null && fromLabel > 0) {
      meters = fromLabel;
    }
  }
  return { meters, label };
}

/** Best-effort: resolve meters, persist when inferred; returns null when unknown (generate still proceeds). */
export async function resolveGoalRaceMetersForGenerate(params: {
  athleteId: string;
  race: GoalRaceMetersInput;
}): Promise<number | null> {
  const { athleteId, race } = params;
  const resolved = resolveGoalRaceMetersInput(race);
  const meters = resolved.meters;
  if (meters == null || meters <= 0) {
    return null;
  }

  const stored =
    race.distanceMeters != null && Number.isFinite(Number(race.distanceMeters))
      ? Math.round(Number(race.distanceMeters))
      : null;
  if (stored == null || stored <= 0) {
    await updateAthleteRaceDistance({
      athleteId,
      athleteRaceId: race.id,
      distanceMeters: meters,
      ...(resolved.label ? { distanceLabel: resolved.label } : {}),
    });
  }
  return meters;
}

/** @deprecated use resolveGoalRaceMetersForGenerate */
export const ensureGoalRaceMetersForGenerate = resolveGoalRaceMetersForGenerate;
