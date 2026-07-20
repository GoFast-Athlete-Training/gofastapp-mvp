import { prisma } from '@/lib/prisma';
import { getAthleteById } from '@/lib/domain-athlete';
import {
  getGoFastWithMeBySlug,
  normalizeGoFastWithMeSlug,
} from '@/lib/gofast-with-me/gofast-with-me-service';

export type FollowTarget = {
  hostAthleteId: string;
  gofastSlugSnapshot: string;
  firstName: string | null;
  lastName: string | null;
  gofastHandle: string | null;
};

/** Enable follower surface for owner when someone follows (legacy: isGoFastContainer). */
export async function ensureFollowSurfaceForOwner(hostAthleteId: string): Promise<void> {
  await prisma.athlete.update({
    where: { id: hostAthleteId },
    data: { isGoFastContainer: true, updatedAt: new Date() },
  });
}

export async function resolveFollowTargetBySlug(rawHandle: string): Promise<FollowTarget | null> {
  const slug = normalizeGoFastWithMeSlug(rawHandle);
  if (!slug) return null;

  const gwm = await getGoFastWithMeBySlug(slug);
  if (!gwm?.athlete) return null;

  return {
    hostAthleteId: gwm.athlete.id,
    gofastSlugSnapshot: gwm.gofastSlugSnapshot,
    firstName: gwm.athlete.firstName,
    lastName: gwm.athlete.lastName,
    gofastHandle: gwm.athlete.gofastHandle,
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

  await ensureFollowSurfaceForOwner(target.hostAthleteId);

  await prisma.gofast_container_memberships.upsert({
    where: {
      containerAthleteId_memberAthleteId: {
        containerAthleteId: target.hostAthleteId,
        memberAthleteId,
      },
    },
    create: {
      containerAthleteId: target.hostAthleteId,
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
  const row = await prisma.gofast_container_memberships.findUnique({
    where: {
      containerAthleteId_memberAthleteId: {
        containerAthleteId: hostAthleteId,
        memberAthleteId,
      },
    },
  });
  return !!row;
}
