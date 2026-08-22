/**
 * Detect in-window athlete races not yet frozen in plan along-way snapshots.
 */

import { parseAthleteRaceAlongWaySnaps } from "@/lib/training/plan-race-snapshots";

export type PlanRaceEventCandidate = {
  athleteRaceId: string;
  raceRegistryId: string;
  race: {
    name: string;
    raceDate: string;
    distanceLabel: string | null;
  };
};

export function getSnappedAthleteRaceIds(athleteRaceAlongWaySnaps: unknown): string[] {
  return parseAthleteRaceAlongWaySnaps(athleteRaceAlongWaySnaps).map(
    (snap) => snap.sourceAthleteRaceId
  );
}

export function computePendingCandidates(
  candidates: PlanRaceEventCandidate[],
  snappedAthleteRaceIds: string[]
): PlanRaceEventCandidate[] {
  const snapped = new Set(snappedAthleteRaceIds);
  return candidates.filter((c) => !snapped.has(c.athleteRaceId));
}

export function serializePlanRaceEventCandidate(row: {
  id: string;
  raceRegistryId: string;
  name: string;
  raceDate: Date;
  distanceLabel: string | null;
}): PlanRaceEventCandidate {
  return {
    athleteRaceId: row.id,
    raceRegistryId: row.raceRegistryId,
    race: {
      name: row.name,
      raceDate: row.raceDate.toISOString(),
      distanceLabel: row.distanceLabel,
    },
  };
}
