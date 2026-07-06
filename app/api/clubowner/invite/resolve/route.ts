export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  AttachClubLeaderClaimError,
  resolveInviteByToken,
} from '@/lib/domain-runclub-leader-claim';

/**
 * GET /api/clubowner/invite/resolve?token=
 * Public pre-auth activation context for Club Manager invite tokens.
 * Public: resolve invite token to club + expected email before auth.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token')?.trim();
  if (!token) {
    return NextResponse.json({ success: false, error: 'token is required' }, { status: 400 });
  }

  try {
    const claim = await resolveInviteByToken(token);
    return NextResponse.json({
      success: true,
      claim: {
        id: claim.claimId,
        runClubId: claim.runClubId,
        runClubSlug: claim.runClubSlug,
        runClubName: claim.runClubName,
        email: claim.email,
        membershipRole: claim.membershipRole,
        status: claim.status,
        inviteExpiresAt: claim.inviteExpiresAt?.toISOString() ?? null,
      },
    });
  } catch (err: unknown) {
    if (err instanceof AttachClubLeaderClaimError) {
      return NextResponse.json(
        { success: false, code: err.code, error: err.message },
        { status: err.code === 'INVITE_INVALID' || err.code === 'INVITE_EXPIRED' ? 404 : 400 }
      );
    }
    console.error('[GET /api/clubowner/invite/resolve]', err);
    return NextResponse.json({ success: false, error: 'Failed to resolve invite' }, { status: 500 });
  }
}
