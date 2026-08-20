export type PublicAthleteRaceSnapshot = {
  id: string;
  raceRegistryId: string;
  name: string;
  raceDate: Date;
  city: string | null;
  state: string | null;
  distanceLabel: string | null;
  distanceMeters: number | null;
  slug: string | null;
  logoUrl: string | null;
};

export type PublicPlanForGoal = {
  id: string;
  athleteRaceId: string | null;
  name: string;
  publicSlug: string | null;
  publicDescription: string | null;
  totalWeeks: number;
};

export function serializePublicAthleteRace(row: PublicAthleteRaceSnapshot) {
  return {
    athleteRaceId: row.id,
    raceRegistryId: row.raceRegistryId,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logoUrl,
    raceDate: row.raceDate.toISOString(),
    city: row.city,
    state: row.state,
    distanceMeters: row.distanceMeters,
    distanceLabel: row.distanceLabel,
  };
}

export function buildPublicTrainingFor(input: {
  goal: {
    id: string;
    name: string | null;
    distance: string;
    goalTime: string | null;
    targetByDate: Date;
  };
  athleteRace: PublicAthleteRaceSnapshot | null;
  publicPlans: PublicPlanForGoal[];
}) {
  const race = input.athleteRace;
  if (!race) return null;

  const publicPlan =
    input.publicPlans.find(
      (candidate) => candidate.athleteRaceId === race.id && candidate.publicSlug?.trim(),
    ) ?? null;

  return {
    athleteRace: serializePublicAthleteRace(race),
    goal: {
      id: input.goal.id,
      name: input.goal.name,
      distance: input.goal.distance,
      goalTime: input.goal.goalTime,
      targetByDate: input.goal.targetByDate.toISOString(),
    },
    publicPlan: publicPlan
      ? {
          id: publicPlan.id,
          slug: publicPlan.publicSlug!,
          title: publicPlan.name,
          description: publicPlan.publicDescription,
          targetDistanceLabel: race.distanceLabel,
          durationWeeks: publicPlan.totalWeeks,
        }
      : null,
  };
}
