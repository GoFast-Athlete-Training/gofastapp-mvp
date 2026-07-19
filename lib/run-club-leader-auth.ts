import { prisma } from '@/lib/prisma';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { isClubManagerWriteRole } from '@/lib/run-club-leader-scope';

export type RunClubLeaderAuthSuccess = {
  athlete: { id: string; firebaseId: string; role?: string | null };
  club: {
    id: string;
    slug: string | null;
    name: string;
  };
  membership: {
    id: string;
    role: string;
    status: string;
  };
};

export type RunClubLeaderAuthFailure = {
  error: string;
  status: 400 | 401 | 403 | 404;
};

/**
 * Resolve club by slug or id and verify the signed-in athlete is a club manager/admin.
 */
export async function requireRunClubLeader(
  request: Request,
  opts: { slug?: string; runClubId?: string }
): Promise<RunClubLeaderAuthSuccess | RunClubLeaderAuthFailure> {
  const slug = opts.slug?.trim();
  const runClubId = opts.runClubId?.trim();
  if (!slug && !runClubId) {
    return { error: 'runClubId or slug is required', status: 400 };
  }

  const auth = await requireAthleteFromBearer(request);
  if ('error' in auth) {
    return { error: auth.error, status: auth.status };
  }
  const { athlete } = auth;

  const club = slug
    ? await prisma.run_clubs.findUnique({
        where: { slug },
        select: { id: true, slug: true, name: true },
      })
    : await prisma.run_clubs.findUnique({
        where: { id: runClubId! },
        select: { id: true, slug: true, name: true },
      });

  if (!club) {
    return { error: 'Run club not found', status: 404 };
  }

  const membership = await prisma.run_club_memberships.findUnique({
    where: {
      runClubId_athleteId: {
        runClubId: club.id,
        athleteId: athlete.id,
      },
    },
    select: { id: true, role: true, status: true },
  });

  if (!membership || membership.status !== 'active' || !isClubManagerWriteRole(membership.role)) {
    return { error: 'Forbidden — club manager access required', status: 403 };
  }

  return {
    athlete: { id: athlete.id, firebaseId: athlete.firebaseId, role: athlete.role },
    club,
    membership,
  };
}

/**
 * Verify leader access for a resource already tied to a runClubId.
 */
export async function requireRunClubLeaderForClubId(
  request: Request,
  runClubId: string
): Promise<RunClubLeaderAuthSuccess | RunClubLeaderAuthFailure> {
  return requireRunClubLeader(request, { runClubId });
}

export async function listLeaderMemberships(athleteId: string) {
  const rows = await prisma.run_club_memberships.findMany({
    where: {
      athleteId,
      status: 'active',
      role: { in: ['manager', 'admin', 'owner'] },
    },
    include: {
      run_clubs: {
        select: {
          id: true,
          slug: true,
          name: true,
          logoUrl: true,
          city: true,
          state: true,
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });
  return rows.filter((m) => isClubManagerWriteRole(m.role));
}

export function leaderAuthFailureResponse(failure: RunClubLeaderAuthFailure) {
  return Response.json({ success: false, error: failure.error }, { status: failure.status });
}
