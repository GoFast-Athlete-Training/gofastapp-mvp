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
  goalName?: string | null;
  goalDistance?: string | null;
  goalTime?: string | null;
  isPrimaryRace?: boolean;
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
    goalTime: row.goalTime ?? null,
    goalName: row.goalName ?? null,
    goalDistance: row.goalDistance ?? null,
    isPrimaryRace: row.isPrimaryRace ?? false,
  };
}

export function buildPublicTrainingFor(input: {
  athleteRace: PublicAthleteRaceSnapshot;
  publicPlans: PublicPlanForGoal[];
  isPrimaryRace?: boolean;
}) {
  const race = input.athleteRace;
  const hasGoalFields = Boolean(
    race.goalTime?.trim() || race.goalName?.trim() || race.goalDistance?.trim()
  );
  if (!hasGoalFields && !input.isPrimaryRace) {
    return null;
  }

  const publicPlan =
    input.publicPlans.find(
      (candidate) => candidate.athleteRaceId === race.id && candidate.publicSlug?.trim(),
    ) ?? null;

  return {
    athleteRace: serializePublicAthleteRace({
      ...race,
      isPrimaryRace: input.isPrimaryRace ?? race.isPrimaryRace ?? false,
    }),
    goal: {
      id: race.id,
      name: race.goalName ?? race.name,
      distance: race.goalDistance ?? race.distanceLabel ?? "",
      goalTime: race.goalTime ?? null,
      targetByDate: race.raceDate.toISOString(),
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
