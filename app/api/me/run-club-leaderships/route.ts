export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { listLeaderMemberships } from '@/lib/run-club-leader-auth';

/**
 * GET /api/me/run-club-leaderships
 *
 * Active run clubs where the signed-in athlete is owner or admin.
 */
export async function GET(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const rows = await listLeaderMemberships(auth.athlete.id);
    const leaderships = rows.map((m) => ({
      runClubId: m.run_clubs.id,
      runClubSlug: m.run_clubs.slug,
      runClubName: m.run_clubs.name,
      logoUrl: m.run_clubs.logoUrl,
      city: m.run_clubs.city,
      state: m.run_clubs.state,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    }));

    return NextResponse.json({ success: true, leaderships });
  } catch (err: unknown) {
    console.error('[GET /api/me/run-club-leaderships] Error:', err);
    return NextResponse.json(
      { error: 'Server error', details: err instanceof Error ? err.message : 'Unknown' },
      { status: 500 }
    );
  }
}
