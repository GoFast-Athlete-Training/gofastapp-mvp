/** Shared door sidebar: goal race vs calendar vs public plan. */

export type DoorSignedUpRace = {
  /** Legacy registry id — prefer athleteRaceId for de-dupe. */
  id: string;
  athleteRaceId?: string | null;
  name: string;
  slug?: string | null;
  raceDate: string;
  city?: string | null;
  state?: string | null;
  distanceLabel?: string | null;
};

export type DoorGoalRaceSource = {
  athleteRaceId?: string | null;
  raceName?: string | null;
  name?: string | null;
  raceDate?: string | null;
  targetByDate?: string | null;
  raceDistanceLabel?: string | null;
  distance?: string | null;
  raceSlug?: string | null;
  raceCity?: string | null;
  raceState?: string | null;
};

export type DoorPlanPrimaryRaceSource = {
  primaryAthleteRaceId?: string | null;
  raceName?: string | null;
  raceDate?: string | null;
  raceDistanceLabel?: string | null;
  raceCity?: string | null;
  raceState?: string | null;
};

export type DoorGoalRace = {
  athleteRaceId: string;
  name: string;
  raceDate: string;
  distanceLabel: string | null;
  slug: string | null;
  city: string | null;
  state: string | null;
};

export type DoorPublishedPlan = {
  slug: string;
  title: string;
};

function raceFromSignup(
  athleteRaceId: string,
  signedUpRaces: DoorSignedUpRace[],
  fallback: {
    name?: string | null;
    raceDate?: string | null;
    distanceLabel?: string | null;
    slug?: string | null;
    city?: string | null;
    state?: string | null;
  }
): DoorGoalRace | null {
  const signup = signedUpRaces.find((r) => r.athleteRaceId === athleteRaceId);
  const raceDate = signup?.raceDate ?? fallback.raceDate;
  const name = signup?.name ?? fallback.name;
  if (!name?.trim() || !raceDate) return null;
  return {
    athleteRaceId,
    name: name.trim(),
    raceDate,
    distanceLabel: signup?.distanceLabel ?? fallback.distanceLabel ?? null,
    slug: signup?.slug ?? fallback.slug ?? null,
    city: signup?.city ?? fallback.city ?? null,
    state: signup?.state ?? fallback.state ?? null,
  };
}

/** Goal race: AthleteGoal.athleteRaceId first, else plan primaryAthleteRaceId. */
export function resolveDoorGoalRace(input: {
  primaryChasingGoal: DoorGoalRaceSource | null | undefined;
  trainingSummary: DoorPlanPrimaryRaceSource | null | undefined;
  signedUpRaces: DoorSignedUpRace[];
}): DoorGoalRace | null {
  const { primaryChasingGoal, trainingSummary, signedUpRaces } = input;

  if (primaryChasingGoal?.athleteRaceId) {
    return raceFromSignup(primaryChasingGoal.athleteRaceId, signedUpRaces, {
      name: primaryChasingGoal.raceName ?? primaryChasingGoal.name,
      raceDate: primaryChasingGoal.raceDate ?? primaryChasingGoal.targetByDate,
      distanceLabel: primaryChasingGoal.raceDistanceLabel ?? primaryChasingGoal.distance,
      slug: primaryChasingGoal.raceSlug,
      city: primaryChasingGoal.raceCity,
      state: primaryChasingGoal.raceState,
    });
  }

  if (trainingSummary?.primaryAthleteRaceId) {
    return raceFromSignup(trainingSummary.primaryAthleteRaceId, signedUpRaces, {
      name: trainingSummary.raceName,
      raceDate: trainingSummary.raceDate,
      distanceLabel: trainingSummary.raceDistanceLabel,
      city: trainingSummary.raceCity,
      state: trainingSummary.raceState,
    });
  }

  return null;
}

function sameCalendarDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return da.toDateString() === db.toDateString();
}

function isSameRaceAsGoal(race: DoorSignedUpRace, goal: DoorGoalRace): boolean {
  if (race.athleteRaceId && race.athleteRaceId === goal.athleteRaceId) return true;
  return (
    race.name.trim().toLowerCase() === goal.name.trim().toLowerCase() &&
    sameCalendarDay(race.raceDate, goal.raceDate)
  );
}

/** Future signups excluding the door goal race. */
export function filterDoorCalendarRaces(
  signedUpRaces: DoorSignedUpRace[],
  goalRace: DoorGoalRace | null,
  now: Date = new Date()
): DoorSignedUpRace[] {
  return signedUpRaces
    .filter((r) => new Date(r.raceDate) >= now)
    .filter((r) => !goalRace || !isSameRaceAsGoal(r, goalRace))
    .slice(0, 8);
}
