export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { findUnclaimedClaimsForEmail } from '@/lib/domain-runclub-leader-claim';

/**
 * GET /api/me/club-leader-claims/pending
 * Passive fallback claims for athlete home when user did not enter via /clubowner.
 */
export async function GET(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const claims = await findUnclaimedClaimsForEmail(auth.athlete.email);
    return NextResponse.json({ success: true, claims });
  } catch (err: unknown) {
    console.error('[GET /api/me/club-leader-claims/pending]', err);
    return NextResponse.json({ success: false, error: 'Failed to load pending claims' }, { status: 500 });
  }
}
