/**
 * Shared goal ↔ athlete_race hydration helpers.
 * Canonical chain: AthleteGoal.athleteRaceId → athlete_races snapshot → race_registry (catalog only).
 */

export const goalAthleteRaceSelect = {
  id: true,
  raceRegistryId: true,
  name: true,
  raceDate: true,
  distanceMeters: true,
  distanceLabel: true,
  city: true,
  state: true,
  slug: true,
  logoUrl: true,
} as const;

export type GoalAthleteRaceSnapshot = {
  id: string;
  raceRegistryId: string;
  name: string;
  raceDate: Date;
  distanceMeters: number | null;
  distanceLabel: string | null;
  city: string | null;
  state: string | null;
  slug: string | null;
  logoUrl: string | null;
};

export function goalRaceRegistryId(
  goal: { athlete_race?: Pick<GoalAthleteRaceSnapshot, "raceRegistryId"> | null }
): string | null {
  return goal.athlete_race?.raceRegistryId ?? null;
}

export type GoalRaceDisplay = {
  id: string;
  slug: string | null;
  name: string;
  raceDate: Date | string;
  distanceLabel: string | null;
  distanceMeters: number | null;
  city: string | null;
  state: string | null;
  logoUrl: string | null;
};

export function goalRaceDisplayFromAthleteRace(
  athleteRace: GoalAthleteRaceSnapshot | null | undefined
): GoalRaceDisplay | null {
  if (!athleteRace) return null;
  return {
    id: athleteRace.raceRegistryId,
    slug: athleteRace.slug,
    name: athleteRace.name,
    raceDate: athleteRace.raceDate,
    distanceLabel: athleteRace.distanceLabel,
    distanceMeters: athleteRace.distanceMeters,
    city: athleteRace.city,
    state: athleteRace.state,
    logoUrl: athleteRace.logoUrl,
  };
}

/** UI/API helper: resolve goal race display from nested athlete_race only. */
export function goalRaceFromGoal(
  goal:
    | {
        athlete_race?: GoalAthleteRaceSnapshot | null;
      }
    | null
    | undefined
): GoalRaceDisplay | null {
  return goalRaceDisplayFromAthleteRace(goal?.athlete_race);
}
