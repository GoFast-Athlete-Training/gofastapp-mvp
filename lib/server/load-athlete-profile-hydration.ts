import { prisma } from '@/lib/prisma';
import {
  derivePrimaryRaceForAthlete,
  ensureAthleteProfileSnapshot,
  type PrimaryRaceSnapshot,
} from '@/lib/athlete-profile-snapshot';
import { normalizeHandle } from '@/lib/server/load-public-athlete-page';

export type AthleteProfileGoal = {
  name: string | null;
  goalTime: string | null;
  targetByDate: string | null;
  raceName: string | null;
};

export type AthleteProfileHydration = {
  athlete: {
    id: string;
    handle: string | null;
    name: string;
    bio: string | null;
    picture: string | null;
  };
  primaryRace: PrimaryRaceSnapshot | null;
  goal: AthleteProfileGoal | null;
  current5kpace: string | null;
};

const profileSnapshotSelect = {
  id: true,
  gofastHandle: true,
  firstName: true,
  lastName: true,
  bio: true,
  photoURL: true,
  fiveKPace: true,
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
} as const;

type AthleteProfileSnapshotRow = {
  id: string;
  gofastHandle: string | null;
  firstName: string | null;
  lastName: string | null;
  bio: string | null;
  photoURL: string | null;
  fiveKPace: string | null;
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

function athleteDisplayName(firstName: string | null, lastName: string | null): string {
  const name = [firstName, lastName].filter(Boolean).join(' ').trim();
  return name || 'Runner';
}

function primaryRaceFromSnapshot(
  athlete: AthleteProfileSnapshotRow
): PrimaryRaceSnapshot | null {
  if (!athlete.primaryRaceRegistryIdSnapshot || !athlete.primaryRaceNameSnapshot) return null;
  return {
    id: athlete.primaryRaceRegistryIdSnapshot,
    slug: athlete.primaryRaceSlugSnapshot,
    name: athlete.primaryRaceNameSnapshot,
    date: athlete.primaryRaceDateSnapshot?.toISOString() ?? null,
    distanceLabel: athlete.primaryRaceDistanceLabelSnapshot,
    city: athlete.primaryRaceCitySnapshot,
    state: athlete.primaryRaceStateSnapshot,
  };
}

function goalFromSnapshot(athlete: AthleteProfileSnapshotRow): AthleteProfileGoal | null {
  const hasGoal =
    athlete.primaryGoalTimeSnapshot?.trim() ||
    athlete.primaryGoalNameSnapshot?.trim() ||
    athlete.primaryGoalRaceNameSnapshot?.trim();

  if (!hasGoal) return null;

  return {
    name: athlete.primaryGoalNameSnapshot,
    goalTime: athlete.primaryGoalTimeSnapshot,
    targetByDate: athlete.primaryGoalTargetByDateSnapshot?.toISOString() ?? null,
    raceName: athlete.primaryGoalRaceNameSnapshot,
  };
}

async function deriveGoalForAthlete(athleteId: string): Promise<AthleteProfileGoal | null> {
  const goal = await prisma.athleteGoal.findFirst({
    where: { athleteId, status: 'ACTIVE' },
    orderBy: { targetByDate: 'asc' },
    include: {
      race_registry: { select: { name: true } },
    },
  });

  if (!goal) return null;

  return {
    name: goal.name,
    goalTime: goal.goalTime,
    targetByDate: goal.targetByDate.toISOString(),
    raceName: goal.race_registry?.name ?? null,
  };
}

export async function loadAthleteProfileHydrationByHandle(
  rawHandle: string
): Promise<AthleteProfileHydration | null> {
  const handle = normalizeHandle(rawHandle || '');
  if (!handle) return null;

  const athlete = await prisma.athlete.findFirst({
    where: { gofastHandle: { equals: handle, mode: 'insensitive' } },
    select: profileSnapshotSelect,
  });

  if (!athlete) return null;

  return buildAthleteProfileHydration(athlete);
}

export async function loadAthleteProfileHydrationById(
  athleteId: string
): Promise<AthleteProfileHydration | null> {
  await ensureAthleteProfileSnapshot(athleteId);

  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: profileSnapshotSelect,
  });

  if (!athlete) return null;

  return buildAthleteProfileHydration(athlete);
}

async function buildAthleteProfileHydration(
  athlete: AthleteProfileSnapshotRow
): Promise<AthleteProfileHydration> {
  const snappedGoal = goalFromSnapshot(athlete);
  const snappedRace = primaryRaceFromSnapshot(athlete);

  const [derivedGoal, derivedRace] = await Promise.all([
    snappedGoal ? Promise.resolve(null) : deriveGoalForAthlete(athlete.id),
    snappedRace ? Promise.resolve(null) : derivePrimaryRaceForAthlete(athlete.id),
  ]);

  return {
    athlete: {
      id: athlete.id,
      handle: athlete.gofastHandle,
      name: athleteDisplayName(athlete.firstName, athlete.lastName),
      bio: athlete.bio,
      picture: athlete.photoURL,
    },
    primaryRace: snappedRace ?? derivedRace,
    goal: snappedGoal ?? derivedGoal,
    current5kpace: athlete.fiveKPace?.trim() || null,
  };
}
