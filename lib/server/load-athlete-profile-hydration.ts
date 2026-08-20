import { prisma } from '@/lib/prisma';
import { loadPrimaryRaceWithGoal } from '@/lib/athlete-profile-snapshot';
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
  primaryRace: {
    id: string;
    athleteRaceId: string;
    slug: string | null;
    name: string;
    date: string | null;
    distanceLabel: string | null;
    city: string | null;
    state: string | null;
  } | null;
  goal: AthleteProfileGoal | null;
  current5kpace: string | null;
};

const profileSelect = {
  id: true,
  gofastHandle: true,
  firstName: true,
  lastName: true,
  bio: true,
  photoURL: true,
  fiveKPace: true,
} as const;

function athleteDisplayName(firstName: string | null, lastName: string | null): string {
  const name = [firstName, lastName].filter(Boolean).join(' ').trim();
  return name || 'Runner';
}

export async function loadAthleteProfileHydrationByHandle(
  rawHandle: string
): Promise<AthleteProfileHydration | null> {
  const handle = normalizeHandle(rawHandle || '');
  if (!handle) return null;

  const athlete = await prisma.athlete.findFirst({
    where: { gofastHandle: { equals: handle, mode: 'insensitive' } },
    select: profileSelect,
  });

  if (!athlete) return null;

  return buildAthleteProfileHydration(athlete);
}

export async function loadAthleteProfileHydrationById(
  athleteId: string
): Promise<AthleteProfileHydration | null> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: profileSelect,
  });

  if (!athlete) return null;

  return buildAthleteProfileHydration(athlete);
}

async function buildAthleteProfileHydration(
  athlete: {
    id: string;
    gofastHandle: string | null;
    firstName: string | null;
    lastName: string | null;
    bio: string | null;
    photoURL: string | null;
    fiveKPace: string | null;
  }
): Promise<AthleteProfileHydration> {
  const { race, goal } = await loadPrimaryRaceWithGoal(athlete.id);

  return {
    athlete: {
      id: athlete.id,
      handle: athlete.gofastHandle,
      name: athleteDisplayName(athlete.firstName, athlete.lastName),
      bio: athlete.bio,
      picture: athlete.photoURL,
    },
    primaryRace: race,
    goal: goal
      ? {
          name: goal.name,
          goalTime: goal.goalTime,
          targetByDate: goal.targetByDate,
          raceName: goal.raceName,
        }
      : null,
    current5kpace: athlete.fiveKPace?.trim() || null,
  };
}
