export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  AttachClubLeaderClaimError,
  resolveClubManagerInviteToken,
} from '@/lib/club-manager-invite-resolve';

/**
 * GET /api/club-manager/invite/resolve?token=
 * Public pre-auth: load complete invite grant (email + club + role) before athlete-link.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token')?.trim();
  if (!token) {
    return NextResponse.json({ success: false, error: 'token is required' }, { status: 400 });
  }

  try {
    const invite = await resolveClubManagerInviteToken(token);
    return NextResponse.json({
      success: true,
      invite,
      /** @deprecated Use invite */
      claim: invite,
    });
  } catch (err: unknown) {
    if (err instanceof AttachClubLeaderClaimError) {
      return NextResponse.json(
        { success: false, code: err.code, error: err.message },
        { status: err.code === 'INVITE_INVALID' || err.code === 'INVITE_EXPIRED' ? 404 : 400 }
      );
    }
    console.error('[GET /api/club-manager/invite/resolve]', err);
    return NextResponse.json({ success: false, error: 'Failed to resolve invite' }, { status: 500 });
  }
}
