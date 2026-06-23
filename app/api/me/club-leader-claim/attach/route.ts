export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import {
  AttachClubLeaderClaimError,
  attachClubLeaderClaim,
} from '@/lib/domain-runclub-leader-claim';

/**
 * POST /api/me/club-leader-claim/attach
 * Attach a seeded club-owner claim to the signed-in athlete.
 */
export async function POST(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await request.json()) as { claimId?: string };
    const claimId = body.claimId?.trim();
    if (!claimId) {
      return NextResponse.json({ success: false, error: 'claimId is required' }, { status: 400 });
    }

    const result = await attachClubLeaderClaim(auth.athlete.id, auth.athlete.email, claimId);
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    if (err instanceof AttachClubLeaderClaimError) {
      return NextResponse.json(
        {
          success: false,
          code: err.code,
          error: err.message,
          ...err.details,
        },
        { status: err.code === 'NO_SEEDED_LEADER_FOR_EMAIL' ? 403 : 400 }
      );
    }
    console.error('[POST /api/me/club-leader-claim/attach]', err);
    return NextResponse.json({ success: false, error: 'Failed to attach club owner access' }, { status: 500 });
  }
}
