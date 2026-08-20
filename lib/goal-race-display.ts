/**
 * Shared athlete_races hydration helpers.
 * Canonical: goal fields live on athlete_races; race_registry is catalog only.
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
  goalName: true,
  goalDescription: true,
  goalDistance: true,
  goalTime: true,
  goalRacePace: true,
  goalPace5K: true,
  whyGoal: true,
  successLooksLike: true,
  completionFeeling: true,
  motivationIcon: true,
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
  goalName?: string | null;
  goalDescription?: string | null;
  goalDistance?: string | null;
  goalTime?: string | null;
  goalRacePace?: number | null;
  goalPace5K?: number | null;
  whyGoal?: string | null;
  successLooksLike?: string | null;
  completionFeeling?: string | null;
  motivationIcon?: string | null;
};

export function goalRaceRegistryId(
  race: Pick<GoalAthleteRaceSnapshot, "raceRegistryId"> | null | undefined
): string | null {
  return race?.raceRegistryId ?? null;
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

/** UI/API helper: resolve race display from athlete_races row or legacy goal wrapper. */
export function goalRaceFromGoal(
  goalOrRace:
    | GoalAthleteRaceSnapshot
    | { athlete_race?: GoalAthleteRaceSnapshot | null }
    | null
    | undefined
): GoalRaceDisplay | null {
  if (!goalOrRace) return null;
  if ("athlete_race" in goalOrRace) {
    return goalRaceDisplayFromAthleteRace(goalOrRace.athlete_race ?? null);
  }
  return goalRaceDisplayFromAthleteRace(goalOrRace as GoalAthleteRaceSnapshot);
}

export function hasGoalOnRace(
  race: Pick<GoalAthleteRaceSnapshot, "goalTime" | "goalName" | "goalDistance"> | null | undefined
): boolean {
  if (!race) return false;
  return Boolean(
    race.goalTime?.trim() || race.goalName?.trim() || race.goalDistance?.trim()
  );
}
