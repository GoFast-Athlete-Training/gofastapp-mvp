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

/** @deprecated Use syncAthleteProfileSnapshot */
export const syncAthleteProfileSnap = syncAthleteProfileSnapshot;
