import { prisma } from '@/lib/prisma';

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
        race_registry: {
          select: {
            id: true,
            slug: true,
            name: true,
            raceDate: true,
            distanceLabel: true,
            city: true,
            state: true,
          },
        },
      },
    }),
    prisma.training_plans.findFirst({
      where: { athleteId, lifecycleStatus: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
      include: {
        race_registry: {
          select: {
            id: true,
            slug: true,
            name: true,
            raceDate: true,
            distanceLabel: true,
            city: true,
            state: true,
          },
        },
      },
    }),
    prisma.athlete_race_signups.findFirst({
      where: {
        athleteId,
        race_registry: {
          isActive: true,
          isCancelled: false,
          raceDate: { gte: new Date() },
        },
      },
      orderBy: { race_registry: { raceDate: 'asc' } },
      include: {
        race_registry: {
          select: {
            id: true,
            slug: true,
            name: true,
            raceDate: true,
            distanceLabel: true,
            city: true,
            state: true,
          },
        },
      },
    }),
  ]);

  const race =
    activeGoal?.race_registry ??
    activePlan?.race_registry ??
    futureSignup?.race_registry ??
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
 * Source of truth remains AthleteGoal / training_plans / race_registry relationships.
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
    race_registry: { name: string } | null;
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
      (activeGoal.race_registry?.name ?? null) !==
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
        race_registry: { select: { name: true } },
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
      primaryGoalRaceNameSnapshot: activeGoal?.race_registry?.name ?? null,
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
        race_registry: { select: { name: true } },
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
