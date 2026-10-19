import { prisma } from '@/lib/prisma';
import { getAthleteById } from '@/lib/domain-athlete';
import {
  normalizeGoFastWithMeSlug,
  resolveAthleteByPublicHandle,
} from '@/lib/gofast-with-me/gofast-with-me-service';

export type FollowTarget = {
  hostAthleteId: string;
  gofastSlugSnapshot: string;
  firstName: string | null;
  lastName: string | null;
  gofastHandle: string | null;
};

export async function resolveFollowTargetBySlug(rawHandle: string): Promise<FollowTarget | null> {
  const slug = normalizeGoFastWithMeSlug(rawHandle);
  if (!slug) return null;

  const athlete = await resolveAthleteByPublicHandle(slug);
  if (!athlete?.gofastHandle?.trim()) return null;

  return {
    hostAthleteId: athlete.id,
    gofastSlugSnapshot: normalizeGoFastWithMeSlug(athlete.gofastHandle) ?? slug,
    firstName: athlete.firstName,
    lastName: athlete.lastName,
    gofastHandle: athlete.gofastHandle,
  };
}

export async function followAthleteBySlug(
  rawHandle: string,
  memberAthleteId: string
): Promise<{ hostAthleteId: string; slug: string }> {
  const target = await resolveFollowTargetBySlug(rawHandle);
  if (!target) {
    throw new Error('GoFastWithMe page not found');
  }

  const member = await getAthleteById(memberAthleteId);
  if (!member) {
    throw new Error('Athlete not found');
  }

  if (target.hostAthleteId === memberAthleteId) {
    throw new Error('You cannot follow yourself');
  }

  await prisma.gfwm_athlete.upsert({
    where: {
      athleteId_memberAthleteId: {
        athleteId: target.hostAthleteId,
        memberAthleteId,
      },
    },
    create: {
      athleteId: target.hostAthleteId,
      memberAthleteId,
      role: 'member',
    },
    update: { updatedAt: new Date() },
  });

  return { hostAthleteId: target.hostAthleteId, slug: target.gofastSlugSnapshot };
}

export async function isFollowingHost(
  hostAthleteId: string,
  memberAthleteId: string
): Promise<boolean> {
  const row = await prisma.gfwm_athlete.findUnique({
    where: {
      athleteId_memberAthleteId: {
        athleteId: hostAthleteId,
        memberAthleteId,
      },
    },
  });
  return !!row;
}

export type FollowingHostRow = {
  hostAthleteId: string;
  gofastHandle: string | null;
  firstName: string | null;
  lastName: string | null;
  photoURL: string | null;
  joinedAt: string;
};

/** Hosts the member follows (gfwm_athlete rows where memberAthleteId = viewer). */
export async function listFollowingForMember(
  memberAthleteId: string
): Promise<FollowingHostRow[]> {
  const rows = await prisma.gfwm_athlete.findMany({
    where: { memberAthleteId },
    orderBy: { joinedAt: 'desc' },
    select: {
      joinedAt: true,
      hostAthlete: {
        select: {
          id: true,
          gofastHandle: true,
          firstName: true,
          lastName: true,
          photoURL: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    hostAthleteId: row.hostAthlete.id,
    gofastHandle: row.hostAthlete.gofastHandle,
    firstName: row.hostAthlete.firstName,
    lastName: row.hostAthlete.lastName,
    photoURL: row.hostAthlete.photoURL,
    joinedAt: row.joinedAt.toISOString(),
  }));
}
