export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  createOrRefreshManagerInviteClaim,
  revokeLeaderClaim,
} from '@/lib/domain-runclub-leader-claim';
import type { RunClubLeaderRole } from '@/lib/run-club-leader-scope';
import { assertStaffBearerAuth } from '@/lib/training/training-engine-auth';

type InviteBody = {
  runClubId: string;
  email: string;
  membershipRole?: RunClubLeaderRole;
  acqRunClubId?: string | null;
  acqClubLeaderId?: string | null;
  managerAssignmentId?: string | null;
  source?: string;
  revoke?: boolean;
};

/**
 * POST /api/internal/run-club-leader-claims/invite
 * Company → Product: seed complete manager grant (email + club + role) and issue invite token.
 */
export async function POST(request: NextRequest) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  try {
    const body = (await request.json()) as InviteBody;
    const runClubId = body.runClubId?.trim();
    const email = body.email?.trim();

    if (!runClubId) {
      return NextResponse.json({ success: false, error: 'runClubId is required' }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ success: false, error: 'email is required' }, { status: 400 });
    }

    if (body.revoke) {
      const revoked = await revokeLeaderClaim(runClubId, email);
      return NextResponse.json({
        success: true,
        revoked: revoked
          ? { id: revoked.id, email: revoked.email, status: revoked.status }
          : null,
      });
    }

    const invite = await createOrRefreshManagerInviteClaim({
      runClubId,
      email,
      membershipRole: body.membershipRole,
      acqRunClubId: body.acqRunClubId ?? null,
      acqClubLeaderId: body.acqClubLeaderId ?? null,
      managerAssignmentId: body.managerAssignmentId ?? null,
      source: body.source ?? 'company-manager-assignment',
    });

    return NextResponse.json({
      success: true,
      claimId: invite.claimId,
      email: invite.email,
      membershipRole: invite.membershipRole,
      status: invite.status,
      runClubId: invite.runClubId,
      runClubSlug: invite.runClubSlug,
      runClubName: invite.runClubName,
      inviteUrl: invite.inviteUrl,
      inviteExpiresAt: invite.inviteExpiresAt.toISOString(),
    });
  } catch (err: unknown) {
    console.error('[POST /api/internal/run-club-leader-claims/invite]', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create manager invite',
        details: err instanceof Error ? err.message : 'Unknown',
      },
      { status: 500 }
    );
  }
}
