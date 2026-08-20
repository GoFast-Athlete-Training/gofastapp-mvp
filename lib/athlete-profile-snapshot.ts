import { prisma } from '@/lib/prisma';
import { athleteRaceGoalSelect } from '@/lib/athlete-race-goal';
import { getPrimaryAthleteRaceForAthlete } from '@/lib/athlete-race-goal';

export type PrimaryRaceSnapshot = {
  id: string;
  athleteRaceId: string;
  slug: string | null;
  name: string;
  date: string | null;
  distanceLabel: string | null;
  city: string | null;
  state: string | null;
};

/**
 * Derive primary race from active plan terminal or nearest future athlete race.
 */
export async function derivePrimaryRaceForAthlete(
  athleteId: string
): Promise<PrimaryRaceSnapshot | null> {
  const row = await getPrimaryAthleteRaceForAthlete(athleteId);
  if (!row) return null;

  return {
    id: row.raceRegistryId,
    athleteRaceId: row.id,
    slug: row.slug,
    name: row.name,
    date: row.raceDate?.toISOString() ?? null,
    distanceLabel: row.distanceLabel,
    city: row.city,
    state: row.state,
  };
}

/** @deprecated Athlete snapshot columns removed — no-op for callers. */
export async function syncAthleteProfileSnapshot(_athleteId: string): Promise<void> {
  /* no-op */
}

/** @deprecated Athlete snapshot columns removed — no-op for callers. */
export async function ensureAthleteProfileSnapshot(_athleteId: string): Promise<boolean> {
  return false;
}

/** @deprecated Use syncAthleteProfileSnapshot */
export const syncAthleteProfileSnap = syncAthleteProfileSnapshot;

export async function derivePrimaryGoalForAthlete(athleteId: string) {
  const row = await getPrimaryAthleteRaceForAthlete(athleteId);
  if (!row || (!row.goalTime?.trim() && !row.goalName?.trim() && !row.goalDistance?.trim())) {
    return null;
  }

  return {
    name: row.goalName,
    goalTime: row.goalTime,
    targetByDate: row.raceDate.toISOString(),
    raceName: row.name,
    distance: row.goalDistance,
    athleteRaceId: row.id,
  };
}

export async function loadPrimaryRaceWithGoal(athleteId: string) {
  const row = await getPrimaryAthleteRaceForAthlete(athleteId);
  if (!row) return { race: null, goal: null };

  const race: PrimaryRaceSnapshot = {
    id: row.raceRegistryId,
    athleteRaceId: row.id,
    slug: row.slug,
    name: row.name,
    date: row.raceDate?.toISOString() ?? null,
    distanceLabel: row.distanceLabel,
    city: row.city,
    state: row.state,
  };

  const goal =
    row.goalTime?.trim() || row.goalName?.trim() || row.goalDistance?.trim()
      ? {
          name: row.goalName,
          goalTime: row.goalTime,
          targetByDate: row.raceDate.toISOString(),
          raceName: row.name,
          distance: row.goalDistance,
          athleteRaceId: row.id,
        }
      : null;

  return { race, goal };
}
