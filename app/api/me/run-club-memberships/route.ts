export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/me/run-club-memberships
 *
 * Active run club memberships for the signed-in athlete (separate from run crews).
 */
export async function GET(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { athlete } = auth;

  try {
    const rows = await prisma.run_club_memberships.findMany({
      where: { athleteId: athlete.id, status: 'active' },
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

    const memberships = rows.map((m) => ({
      runClubId: m.run_clubs.id,
      runClubSlug: m.run_clubs.slug,
      runClubName: m.run_clubs.name,
      logoUrl: m.run_clubs.logoUrl,
      city: m.run_clubs.city,
      state: m.run_clubs.state,
      joinedAt: m.joinedAt.toISOString(),
      role: m.role,
      status: m.status,
    }));

    return NextResponse.json({ success: true, memberships });
  } catch (err: unknown) {
    console.error('[GET /api/me/run-club-memberships] Error:', err);
    return NextResponse.json(
      {
        error: 'Server error',
        details: err instanceof Error ? err.message : 'Unknown',
      },
      { status: 500 }
    );
  }
}
