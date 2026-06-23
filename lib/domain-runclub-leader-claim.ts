import { prisma } from '@/lib/prisma';
import { listLeaderMemberships } from '@/lib/run-club-leader-auth';
import type { RunClubLeaderRole } from '@/lib/run-club-leader-scope';
import { mapAcqRoleToMembershipRole, normalizeLeaderEmail } from '@/lib/run-club-leader-role-map';

function generateMembershipId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

export type ClubLeaderClaimStatus = 'unclaimed' | 'claimed' | 'revoked';

export type ClubLeaderClaimRow = {
  id: string;
  runClubId: string;
  runClubSlug: string | null;
  runClubName: string;
  email: string;
  membershipRole: string;
  status: ClubLeaderClaimStatus;
  acqClubLeaderId: string | null;
};

export type ClubOwnerResolveState =
  | { state: 'unmatched'; athleteEmail: string | null }
  | { state: 'alreadyActive'; clubs: Array<{ runClubId: string; runClubSlug: string | null; runClubName: string; role: string }> }
  | { state: 'matchedOne'; claim: ClubLeaderClaimRow }
  | { state: 'matchedMany'; claims: ClubLeaderClaimRow[] };

export type AttachClaimErrorCode =
  | 'CLUB_NOT_FOUND'
  | 'NO_SEEDED_LEADER_FOR_EMAIL'
  | 'CLAIM_NOT_FOUND'
  | 'CLAIM_ALREADY_USED'
  | 'CLAIM_REVOKED'
  | 'EMAIL_MISMATCH';

export class AttachClubLeaderClaimError extends Error {
  code: AttachClaimErrorCode;
  details?: Record<string, unknown>;

  constructor(code: AttachClaimErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

function mapClaimRow(row: {
  id: string;
  runClubId: string;
  email: string;
  membershipRole: string;
  status: string;
  acqClubLeaderId: string | null;
  run_clubs: { slug: string | null; name: string };
}): ClubLeaderClaimRow {
  return {
    id: row.id,
    runClubId: row.runClubId,
    runClubSlug: row.run_clubs.slug,
    runClubName: row.run_clubs.name,
    email: row.email,
    membershipRole: row.membershipRole,
    status: row.status as ClubLeaderClaimStatus,
    acqClubLeaderId: row.acqClubLeaderId,
  };
}

const claimInclude = {
  run_clubs: { select: { id: true, slug: true, name: true } },
} as const;

export async function syncLeaderClaim(input: {
  runClubId: string;
  email: string;
  membershipRole?: RunClubLeaderRole;
  acqClubLeaderId?: string | null;
  acqRunClubId?: string | null;
  source?: string;
}) {
  const normalizedEmail = normalizeLeaderEmail(input.email);
  if (!normalizedEmail) {
    throw new Error('Leader email is required for sync');
  }

  const club = await prisma.run_clubs.findUnique({
    where: { id: input.runClubId },
    select: { id: true },
  });
  if (!club) {
    throw new Error(`Run club not found: ${input.runClubId}`);
  }

  const role = input.membershipRole ?? 'admin';

  const existing = await prisma.run_club_leader_claims.findUnique({
    where: {
      runClubId_email: {
        runClubId: input.runClubId,
        email: normalizedEmail,
      },
    },
  });

  if (existing) {
    return prisma.run_club_leader_claims.update({
      where: { id: existing.id },
      data: {
        membershipRole: role,
        acqClubLeaderId: input.acqClubLeaderId ?? undefined,
        acqRunClubId: input.acqRunClubId ?? undefined,
        source: input.source ?? undefined,
        ...(existing.status === 'revoked' ? { status: 'unclaimed' } : {}),
      },
      include: claimInclude,
    });
  }

  return prisma.run_club_leader_claims.create({
    data: {
      runClubId: input.runClubId,
      email: normalizedEmail,
      membershipRole: role,
      status: 'unclaimed',
      acqClubLeaderId: input.acqClubLeaderId ?? null,
      acqRunClubId: input.acqRunClubId ?? null,
      source: input.source ?? 'company-sync',
    },
    include: claimInclude,
  });
}

export async function revokeLeaderClaim(runClubId: string, email: string) {
  const normalizedEmail = normalizeLeaderEmail(email);
  if (!normalizedEmail) return null;

  const existing = await prisma.run_club_leader_claims.findUnique({
    where: { runClubId_email: { runClubId, email: normalizedEmail } },
  });
  if (!existing) return null;

  return prisma.run_club_leader_claims.update({
    where: { id: existing.id },
    data: { status: 'revoked' },
    include: claimInclude,
  });
}

export async function listClaimsForRunClub(runClubId: string) {
  const rows = await prisma.run_club_leader_claims.findMany({
    where: { runClubId },
    include: claimInclude,
    orderBy: { createdAt: 'asc' },
  });
  return rows.map(mapClaimRow);
}

export async function findUnclaimedClaimsForEmail(email: string | null | undefined) {
  const normalizedEmail = normalizeLeaderEmail(email);
  if (!normalizedEmail) return [];

  const rows = await prisma.run_club_leader_claims.findMany({
    where: { email: normalizedEmail, status: 'unclaimed' },
    include: claimInclude,
    orderBy: { createdAt: 'asc' },
  });

  return rows.map(mapClaimRow);
}

export async function resolveClubOwnerState(
  athleteId: string,
  athleteEmail: string | null | undefined
): Promise<ClubOwnerResolveState> {
  const normalizedEmail = normalizeLeaderEmail(athleteEmail);

  const activeLeaderships = await listLeaderMemberships(athleteId);
  if (activeLeaderships.length > 0) {
    return {
      state: 'alreadyActive',
      clubs: activeLeaderships.map((m) => ({
        runClubId: m.run_clubs.id,
        runClubSlug: m.run_clubs.slug,
        runClubName: m.run_clubs.name,
        role: m.role,
      })),
    };
  }

  const unclaimed = await findUnclaimedClaimsForEmail(normalizedEmail);
  if (unclaimed.length === 0) {
    return { state: 'unmatched', athleteEmail: normalizedEmail };
  }
  if (unclaimed.length === 1) {
    return { state: 'matchedOne', claim: unclaimed[0]! };
  }
  return { state: 'matchedMany', claims: unclaimed };
}

export async function attachClubLeaderClaim(athleteId: string, athleteEmail: string | null | undefined, claimId: string) {
  const normalizedEmail = normalizeLeaderEmail(athleteEmail);
  if (!normalizedEmail) {
    throw new AttachClubLeaderClaimError(
      'EMAIL_MISMATCH',
      'A verified email is required to claim club-owner access'
    );
  }

  const claim = await prisma.run_club_leader_claims.findUnique({
    where: { id: claimId },
    include: claimInclude,
  });

  if (!claim) {
    throw new AttachClubLeaderClaimError('CLAIM_NOT_FOUND', 'Club-owner setup not found');
  }

  if (claim.status === 'revoked') {
    throw new AttachClubLeaderClaimError('CLAIM_REVOKED', 'This club-owner setup was revoked', {
      clubName: claim.run_clubs.name,
    });
  }

  if (claim.status === 'claimed') {
    if (claim.claimedByAthleteId === athleteId) {
      return getAttachResult(athleteId, claim.runClubId);
    }
    throw new AttachClubLeaderClaimError('CLAIM_ALREADY_USED', 'This club-owner setup was already claimed', {
      clubName: claim.run_clubs.name,
    });
  }

  if (claim.email !== normalizedEmail) {
    throw new AttachClubLeaderClaimError(
      'NO_SEEDED_LEADER_FOR_EMAIL',
      'We could not find a club-owner setup for this email',
      { athleteEmail: normalizedEmail }
    );
  }

  const role = claim.membershipRole as RunClubLeaderRole;

  await prisma.$transaction(async (tx) => {
    await tx.run_club_memberships.upsert({
      where: {
        runClubId_athleteId: {
          runClubId: claim.runClubId,
          athleteId,
        },
      },
      create: {
        id: generateMembershipId(),
        runClubId: claim.runClubId,
        athleteId,
        role,
        status: 'active',
      },
      update: {
        role,
        status: 'active',
      },
    });

    await tx.athlete.update({
      where: { id: athleteId },
      data: {
        role: 'CLUB_LEADER',
        runClubId: claim.runClubId,
      },
    });

    await tx.run_club_leader_claims.update({
      where: { id: claim.id },
      data: {
        status: 'claimed',
        claimedByAthleteId: athleteId,
        claimedAt: new Date(),
      },
    });
  });

  return getAttachResult(athleteId, claim.runClubId);
}

async function getAttachResult(athleteId: string, runClubId: string) {
  const club = await prisma.run_clubs.findUnique({
    where: { id: runClubId },
    select: { id: true, slug: true, name: true },
  });
  if (!club) {
    throw new AttachClubLeaderClaimError('CLUB_NOT_FOUND', 'Run club not found');
  }

  const membership = await prisma.run_club_memberships.findUnique({
    where: { runClubId_athleteId: { runClubId, athleteId } },
    select: { role: true },
  });

  return {
    runClubId: club.id,
    runClubSlug: club.slug,
    runClubName: club.name,
    membershipRole: membership?.role ?? 'admin',
  };
}

export { mapAcqRoleToMembershipRole, normalizeLeaderEmail };
