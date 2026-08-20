import { prisma } from '@/lib/prisma';
import { goalAthleteRaceSelect } from '@/lib/goal-race-display';

export type PrimaryRaceSnapshot = {
  id: string;
  slug: string | null;
  name: string;
  date: string | null;
  distanceLabel: string | null;
  city: string | null;
  state: string | null;
};

/**
 * Derive primary race from active goal, active training plan, or nearest future signup.
 */
export async function derivePrimaryRaceForAthlete(
  athleteId: string
): Promise<PrimaryRaceSnapshot | null> {
  const [activeGoal, activePlan, futureSignup] = await Promise.all([
    prisma.athleteGoal.findFirst({
      where: { athleteId, status: 'ACTIVE' },
      orderBy: { targetByDate: 'asc' },
      include: {
        athlete_race: { select: goalAthleteRaceSelect },
      },
    }),
    prisma.training_plans.findFirst({
      where: { athleteId, lifecycleStatus: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
      include: {
        athlete_race: { select: goalAthleteRaceSelect },
      },
    }),
    prisma.athlete_races.findFirst({
      where: {
        athleteId,
        raceDate: { gte: new Date() },
      },
      orderBy: { raceDate: 'asc' },
      select: goalAthleteRaceSelect,
    }),
  ]);

  const planPrimary = activePlan?.athlete_race;
  const raceFromPlan = planPrimary
    ? {
        id: planPrimary.raceRegistryId,
        slug: planPrimary.slug,
        name: planPrimary.name,
        raceDate: planPrimary.raceDate,
        distanceLabel: planPrimary.distanceLabel,
        city: planPrimary.city,
        state: planPrimary.state,
      }
    : null;

  const raceFromGoal = activeGoal?.athlete_race
    ? {
        id: activeGoal.athlete_race.raceRegistryId,
        slug: activeGoal.athlete_race.slug,
        name: activeGoal.athlete_race.name,
        raceDate: activeGoal.athlete_race.raceDate,
        distanceLabel: activeGoal.athlete_race.distanceLabel,
        city: activeGoal.athlete_race.city,
        state: activeGoal.athlete_race.state,
      }
    : null;

  const race =
    raceFromPlan ??
    raceFromGoal ??
    (futureSignup
      ? {
          id: futureSignup.raceRegistryId,
          slug: futureSignup.slug,
          name: futureSignup.name,
          raceDate: futureSignup.raceDate,
          distanceLabel: futureSignup.distanceLabel,
          city: futureSignup.city,
          state: futureSignup.state,
        }
      : null) ??
    null;

  if (!race) return null;

  return {
    id: race.id,
    slug: race.slug,
    name: race.name,
    date: race.raceDate?.toISOString() ?? null,
    distanceLabel: race.distanceLabel,
    city: race.city,
    state: race.state,
  };
}

/**
 * Copy active goal + primary race display values into Athlete snapshot columns.
 * Source of truth remains AthleteGoal / training_plans / athlete_races relationships.
 */
function snapshotNeedsRepair(params: {
  athlete: {
    primaryGoalNameSnapshot: string | null;
    primaryGoalTimeSnapshot: string | null;
    primaryGoalTargetByDateSnapshot: Date | null;
    primaryGoalRaceNameSnapshot: string | null;
    primaryRaceRegistryIdSnapshot: string | null;
    primaryRaceSlugSnapshot: string | null;
    primaryRaceNameSnapshot: string | null;
    primaryRaceDateSnapshot: Date | null;
    primaryRaceDistanceLabelSnapshot: string | null;
    primaryRaceCitySnapshot: string | null;
    primaryRaceStateSnapshot: string | null;
  };
  activeGoal: {
    name: string | null;
    goalTime: string | null;
    targetByDate: Date;
    athlete_race: { name: string } | null;
  } | null;
  primaryRace: PrimaryRaceSnapshot | null;
}): boolean {
  const { athlete, activeGoal, primaryRace } = params;

  if (activeGoal) {
    const goalTime = activeGoal.goalTime?.trim() || null;
    const snapTime = athlete.primaryGoalTimeSnapshot?.trim() || null;
    if (goalTime !== snapTime) return true;
    if ((activeGoal.name ?? null) !== (athlete.primaryGoalNameSnapshot ?? null)) return true;
    if (
      (activeGoal.athlete_race?.name ?? null) !==
      (athlete.primaryGoalRaceNameSnapshot ?? null)
    ) {
      return true;
    }
    if (
      activeGoal.targetByDate.getTime() !==
      (athlete.primaryGoalTargetByDateSnapshot?.getTime() ?? NaN)
    ) {
      return true;
    }
  } else if (
    athlete.primaryGoalTimeSnapshot ||
    athlete.primaryGoalNameSnapshot ||
    athlete.primaryGoalRaceNameSnapshot ||
    athlete.primaryGoalTargetByDateSnapshot
  ) {
    return true;
  }

  if (primaryRace) {
    if ((primaryRace.id ?? null) !== (athlete.primaryRaceRegistryIdSnapshot ?? null)) {
      return true;
    }
    if ((primaryRace.name ?? null) !== (athlete.primaryRaceNameSnapshot ?? null)) {
      return true;
    }
    if ((primaryRace.slug ?? null) !== (athlete.primaryRaceSlugSnapshot ?? null)) {
      return true;
    }
    if (
      (primaryRace.date ? new Date(primaryRace.date).getTime() : null) !==
      (athlete.primaryRaceDateSnapshot?.getTime() ?? null)
    ) {
      return true;
    }
    if (
      (primaryRace.distanceLabel ?? null) !==
      (athlete.primaryRaceDistanceLabelSnapshot ?? null)
    ) {
      return true;
    }
    if ((primaryRace.city ?? null) !== (athlete.primaryRaceCitySnapshot ?? null)) return true;
    if ((primaryRace.state ?? null) !== (athlete.primaryRaceStateSnapshot ?? null)) return true;
  } else if (
    athlete.primaryRaceRegistryIdSnapshot ||
    athlete.primaryRaceNameSnapshot ||
    athlete.primaryRaceDateSnapshot
  ) {
    return true;
  }

  return false;
}

export async function syncAthleteProfileSnapshot(athleteId: string): Promise<void> {
  const [activeGoal, primaryRace] = await Promise.all([
    prisma.athleteGoal.findFirst({
      where: { athleteId, status: 'ACTIVE' },
      orderBy: { targetByDate: 'asc' },
      include: {
        athlete_race: { select: { name: true } },
      },
    }),
    derivePrimaryRaceForAthlete(athleteId),
  ]);

  await prisma.athlete.update({
    where: { id: athleteId },
    data: {
      primaryGoalNameSnapshot: activeGoal?.name ?? null,
      primaryGoalTimeSnapshot: activeGoal?.goalTime ?? null,
      primaryGoalTargetByDateSnapshot: activeGoal?.targetByDate ?? null,
      primaryGoalRaceNameSnapshot: activeGoal?.athlete_race?.name ?? null,
      primaryRaceRegistryIdSnapshot: primaryRace?.id ?? null,
      primaryRaceSlugSnapshot: primaryRace?.slug ?? null,
      primaryRaceNameSnapshot: primaryRace?.name ?? null,
      primaryRaceDateSnapshot: primaryRace?.date ? new Date(primaryRace.date) : null,
      primaryRaceDistanceLabelSnapshot: primaryRace?.distanceLabel ?? null,
      primaryRaceCitySnapshot: primaryRace?.city ?? null,
      primaryRaceStateSnapshot: primaryRace?.state ?? null,
      updatedAt: new Date(),
    },
  });
}

/**
 * Self-heal athlete profile snapshots on read when null or stale vs source rows.
 */
export async function ensureAthleteProfileSnapshot(athleteId: string): Promise<boolean> {
  const [athlete, activeGoal, primaryRace] = await Promise.all([
    prisma.athlete.findUnique({
      where: { id: athleteId },
      select: {
        primaryGoalNameSnapshot: true,
        primaryGoalTimeSnapshot: true,
        primaryGoalTargetByDateSnapshot: true,
        primaryGoalRaceNameSnapshot: true,
        primaryRaceRegistryIdSnapshot: true,
        primaryRaceSlugSnapshot: true,
        primaryRaceNameSnapshot: true,
        primaryRaceDateSnapshot: true,
        primaryRaceDistanceLabelSnapshot: true,
        primaryRaceCitySnapshot: true,
        primaryRaceStateSnapshot: true,
      },
    }),
    prisma.athleteGoal.findFirst({
      where: { athleteId, status: 'ACTIVE' },
      orderBy: { targetByDate: 'asc' },
      include: {
        athlete_race: { select: { name: true } },
      },
    }),
    derivePrimaryRaceForAthlete(athleteId),
  ]);

  if (!athlete) return false;

  const needsRepair = snapshotNeedsRepair({ athlete, activeGoal, primaryRace });
  if (!needsRepair) return false;

  await syncAthleteProfileSnapshot(athleteId);
  return true;
}

/** @deprecated Use syncAthleteProfileSnapshot */
export const syncAthleteProfileSnap = syncAthleteProfileSnapshot;
