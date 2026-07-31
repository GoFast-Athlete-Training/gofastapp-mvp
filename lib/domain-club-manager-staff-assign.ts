import { prisma } from '@/lib/prisma';
import {
  canonicalClubManagerRoleForStorage,
  type ClubManagerWriteRole,
  isClubManagerWriteRole,
} from '@/lib/club-manager-membership-roles';
import { syncClubLeaderProductRole } from '@/lib/athlete-product-roles';
import { normalizeLeaderEmail } from '@/lib/domain-runclub-leader-claim';

function generateMembershipId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

export type ProdAthleteLookupRow = {
  athleteId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  gofastHandle: string | null;
  productRoles: string[];
  clubMemberships: Array<{
    runClubId: string;
    runClubSlug: string | null;
    runClubName: string;
    role: string;
    status: string;
  }>;
};

export type ManagerMembershipState = {
  athleteId: string;
  runClubId: string;
  runClubSlug: string | null;
  runClubName: string;
  membershipRole: string;
  membershipStatus: string;
  hasClubLeaderProductRole: boolean;
};

export async function lookupAthletesByEmail(email: string): Promise<ProdAthleteLookupRow[]> {
  const normalized = normalizeLeaderEmail(email);
  if (!normalized) return [];

  const athletes = await prisma.athlete.findMany({
    where: { email: { equals: normalized, mode: 'insensitive' } },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      gofastHandle: true,
      athlete_product_roles: { select: { role: true } },
      run_club_memberships: {
        where: { status: 'active' },
        select: {
          role: true,
          status: true,
          run_clubs: { select: { id: true, slug: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 5,
  });

  return athletes.map((a) => ({
    athleteId: a.id,
    email: a.email,
    firstName: a.firstName,
    lastName: a.lastName,
    gofastHandle: a.gofastHandle,
    productRoles: a.athlete_product_roles.map((r) => r.role),
    clubMemberships: a.run_club_memberships.map((m) => ({
      runClubId: m.run_clubs.id,
      runClubSlug: m.run_clubs.slug,
      runClubName: m.run_clubs.name,
      role: m.role,
      status: m.status,
    })),
  }));
}

async function getMembershipState(
  athleteId: string,
  runClubId: string
): Promise<ManagerMembershipState> {
  const club = await prisma.run_clubs.findUnique({
    where: { id: runClubId },
    select: { id: true, slug: true, name: true },
  });
  if (!club) {
    throw new Error('Run club not found');
  }

  const membership = await prisma.run_club_memberships.findUnique({
    where: { runClubId_athleteId: { runClubId, athleteId } },
    select: { role: true, status: true },
  });

  const productRoles = await prisma.athlete_product_roles.findMany({
    where: { athleteId, role: 'CLUB_LEADER' },
    select: { role: true },
  });

  return {
    athleteId,
    runClubId: club.id,
    runClubSlug: club.slug,
    runClubName: club.name,
    membershipRole: membership?.role ?? 'member',
    membershipStatus: membership?.status ?? 'left',
    hasClubLeaderProductRole: productRoles.length > 0,
  };
}

export async function assignClubManagerMembership(input: {
  runClubId: string;
  athleteId: string;
  membershipRole?: ClubManagerWriteRole | string | null;
  managerAssignmentId?: string | null;
}): Promise<ManagerMembershipState> {
  const role = canonicalClubManagerRoleForStorage(input.membershipRole, 'manager');

  const athlete = await prisma.athlete.findUnique({
    where: { id: input.athleteId },
    select: { id: true },
  });
  if (!athlete) {
    throw new Error('Athlete not found');
  }

  const club = await prisma.run_clubs.findUnique({
    where: { id: input.runClubId },
    select: { id: true },
  });
  if (!club) {
    throw new Error('Run club not found');
  }

  await prisma.$transaction(async (tx) => {
    await tx.run_club_memberships.upsert({
      where: {
        runClubId_athleteId: {
          runClubId: input.runClubId,
          athleteId: input.athleteId,
        },
      },
      create: {
        id: generateMembershipId(),
        runClubId: input.runClubId,
        athleteId: input.athleteId,
        role,
        status: 'active',
      },
      update: {
        role,
        status: 'active',
      },
    });

    if (input.managerAssignmentId) {
      await tx.run_club_leader_claims.updateMany({
        where: {
          runClubId: input.runClubId,
          managerAssignmentId: input.managerAssignmentId,
        },
        data: {
          status: 'claimed',
          claimedByAthleteId: input.athleteId,
          claimedAt: new Date(),
        },
      });
    }
  });

  await syncClubLeaderProductRole(input.athleteId);
  return getMembershipState(input.athleteId, input.runClubId);
}

/** Demote manager/admin to member while keeping club membership active. */
export async function deactivateClubManagerAccess(input: {
  runClubId: string;
  athleteId: string;
}): Promise<ManagerMembershipState> {
  const membership = await prisma.run_club_memberships.findUnique({
    where: {
      runClubId_athleteId: {
        runClubId: input.runClubId,
        athleteId: input.athleteId,
      },
    },
  });

  if (!membership) {
    throw new Error('Club membership not found');
  }

  if (!isClubManagerWriteRole(membership.role)) {
    return getMembershipState(input.athleteId, input.runClubId);
  }

  await prisma.run_club_memberships.update({
    where: { id: membership.id },
    data: { role: 'member' },
  });

  await syncClubLeaderProductRole(input.athleteId);
  return getMembershipState(input.athleteId, input.runClubId);
}

/** Remove athlete from club (membership left). */
export async function removeAthleteFromClub(input: {
  runClubId: string;
  athleteId: string;
}): Promise<ManagerMembershipState> {
  const membership = await prisma.run_club_memberships.findUnique({
    where: {
      runClubId_athleteId: {
        runClubId: input.runClubId,
        athleteId: input.athleteId,
      },
    },
  });

  if (membership) {
    await prisma.run_club_memberships.update({
      where: { id: membership.id },
      data: { status: 'left', role: 'member' },
    });
  }

  await syncClubLeaderProductRole(input.athleteId);
  return getMembershipState(input.athleteId, input.runClubId);
}
