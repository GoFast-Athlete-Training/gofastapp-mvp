import { prisma } from './prisma';

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

export async function getRunClubBySlug(slug: string) {
  return prisma.run_clubs.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      city: true,
      state: true,
      neighborhood: true,
      description: true,
      allRunsDescription: true,
      websiteUrl: true,
      instagramUrl: true,
      stravaUrl: true,
    },
  });
}

export async function joinRunClubBySlug(slug: string, athleteId: string) {
  const club = await getRunClubBySlug(slug);
  if (!club) {
    throw new Error('Run club not found');
  }

  const existing = await prisma.run_club_memberships.findUnique({
    where: {
      runClubId_athleteId: {
        runClubId: club.id,
        athleteId,
      },
    },
  });

  if (existing) {
    if (existing.status === 'active') {
      return { club, membership: existing };
    }

    const reactivated = await prisma.run_club_memberships.update({
      where: { id: existing.id },
      data: {
        status: 'active',
        joinedAt: new Date(),
      },
    });

    return { club, membership: reactivated };
  }

  const membership = await prisma.run_club_memberships.create({
    data: {
      id: generateId(),
      runClubId: club.id,
      athleteId,
      role: 'member',
      status: 'active',
    },
  });

  return { club, membership };
}

export async function leaveRunClubBySlug(slug: string, athleteId: string) {
  const club = await getRunClubBySlug(slug);
  if (!club) {
    throw new Error('Run club not found');
  }

  const existing = await prisma.run_club_memberships.findUnique({
    where: {
      runClubId_athleteId: {
        runClubId: club.id,
        athleteId,
      },
    },
  });

  if (!existing || existing.status !== 'active') {
    return { club, membership: existing };
  }

  const membership = await prisma.run_club_memberships.update({
    where: { id: existing.id },
    data: { status: 'left' },
  });

  return { club, membership };
}

export async function getActiveMemberCount(runClubId: string) {
  return prisma.run_club_memberships.count({
    where: {
      runClubId,
      status: 'active',
    },
  });
}

export async function getViewerMembership(runClubId: string, athleteId: string | null) {
  if (!athleteId) return null;

  const membership = await prisma.run_club_memberships.findUnique({
    where: {
      runClubId_athleteId: {
        runClubId,
        athleteId,
      },
    },
    select: {
      id: true,
      role: true,
      status: true,
      joinedAt: true,
    },
  });

  if (!membership || membership.status !== 'active') {
    return {
      isMember: false,
      role: membership?.role ?? null,
      status: membership?.status ?? null,
      joinedAt: membership?.joinedAt?.toISOString() ?? null,
    };
  }

  return {
    isMember: true,
    role: membership.role,
    status: membership.status,
    joinedAt: membership.joinedAt.toISOString(),
  };
}
