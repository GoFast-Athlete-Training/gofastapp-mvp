export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  mapAcqRoleToMembershipRole,
  normalizeLeaderEmail,
  revokeLeaderClaim,
  syncLeaderClaim,
} from '@/lib/domain-runclub-leader-claim';
import { assertStaffBearerAuth } from '@/lib/training/training-engine-auth';

type SyncBody = {
  runClubId: string;
  leaders?: Array<{
    email: string;
    acqClubLeaderId?: string | null;
    acqRole?: string | null;
  }>;
  acqRunClubId?: string | null;
  source?: string;
  revokeEmails?: string[];
};

/**
 * POST /api/internal/run-club-leader-claims/sync
 * Company → Product: seed/update unclaimed club-owner slots by email.
 */
export async function POST(request: NextRequest) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  try {
    const body = (await request.json()) as SyncBody;
    const runClubId = body.runClubId?.trim();
    if (!runClubId) {
      return NextResponse.json({ success: false, error: 'runClubId is required' }, { status: 400 });
    }

    const synced: unknown[] = [];
    const revoked: unknown[] = [];

    for (const leader of body.leaders ?? []) {
      const email = normalizeLeaderEmail(leader.email);
      if (!email) continue;
      const row = await syncLeaderClaim({
        runClubId,
        email,
        membershipRole: mapAcqRoleToMembershipRole(leader.acqRole),
        acqClubLeaderId: leader.acqClubLeaderId ?? null,
        acqRunClubId: body.acqRunClubId ?? null,
        source: body.source ?? 'company-sync',
      });
      synced.push({
        id: row.id,
        email: row.email,
        status: row.status,
        membershipRole: row.membershipRole,
      });
    }

    for (const rawEmail of body.revokeEmails ?? []) {
      const row = await revokeLeaderClaim(runClubId, rawEmail);
      if (row) revoked.push({ id: row.id, email: row.email, status: row.status });
    }

    return NextResponse.json({ success: true, synced, revoked });
  } catch (err: unknown) {
    console.error('[POST /api/internal/run-club-leader-claims/sync]', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to sync club leader claims',
        details: err instanceof Error ? err.message : 'Unknown',
      },
      { status: 500 }
    );
  }
}
