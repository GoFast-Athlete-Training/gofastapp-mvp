export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import {
  AttachClubLeaderClaimError,
  resolveClubManagerAccessForAthlete,
} from '@/lib/club-manager-resolve';

/**
 * POST /api/me/club-manager-resolve
 * Step 2 after athlete-link: attach pre-seeded manager grant (membership + role) to athlete.
 */
export async function POST(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await request.json()) as { grantId?: string; inviteToken?: string; claimId?: string };
    const result = await resolveClubManagerAccessForAthlete(auth.athlete.id, auth.athlete.email, {
      grantId: body.grantId?.trim() || body.claimId?.trim(),
      inviteToken: body.inviteToken?.trim(),
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    if (err instanceof AttachClubLeaderClaimError) {
      const legacy403 =
        err.code === 'NO_INVITE_FOR_EMAIL' || err.code === 'NO_SEEDED_LEADER_FOR_EMAIL';
      return NextResponse.json(
        {
          success: false,
          code: err.code,
          error: err.message,
          ...err.details,
        },
        { status: legacy403 || err.code === 'EMAIL_MISMATCH' ? 403 : 400 }
      );
    }
    const message = err instanceof Error ? err.message : 'Failed to activate manager access';
    const status = message.includes('required') ? 400 : 500;
    console.error('[POST /api/me/club-manager-resolve]', err);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
