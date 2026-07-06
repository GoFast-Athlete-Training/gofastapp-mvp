export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { resolveClubOwnerState } from '@/lib/domain-runclub-leader-claim';

/**
 * GET /api/me/club-leader-claims/resolve
 * Legacy email-matched resolver for /welcome-club-owner fallback (no activation token).
 */
export async function GET(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const resolved = await resolveClubOwnerState(auth.athlete.id, auth.athlete.email);
    return NextResponse.json({ success: true, ...resolved });
  } catch (err: unknown) {
    console.error('[GET /api/me/club-leader-claims/resolve]', err);
    return NextResponse.json({ success: false, error: 'Failed to resolve club owner state' }, { status: 500 });
  }
}
