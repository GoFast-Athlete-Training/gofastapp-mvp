export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  assignClubManagerMembership,
  deactivateClubManagerAccess,
  lookupAthletesByEmail,
  removeAthleteFromClub,
} from '@/lib/domain-club-manager-staff-assign';
import { normalizeLeaderEmail } from '@/lib/domain-runclub-leader-claim';
import type { RunClubLeaderRole } from '@/lib/run-club-leader-scope';
import { assertStaffBearerAuth } from '@/lib/training/training-engine-auth';

type AssignBody = {
  action?: 'assign' | 'deactivate' | 'remove';
  runClubId?: string;
  athleteId?: string;
  email?: string;
  membershipRole?: RunClubLeaderRole;
  managerAssignmentId?: string | null;
};

/**
 * POST /api/internal/run-club-leader-claims/assign
 * Company → Product: direct manager membership mutations (existing athletes).
 */
export async function POST(request: NextRequest) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  try {
    const body = (await request.json()) as AssignBody;
    const runClubId = body.runClubId?.trim();
    const action = body.action ?? 'assign';

    if (!runClubId) {
      return NextResponse.json({ success: false, error: 'runClubId is required' }, { status: 400 });
    }

    let athleteId = body.athleteId?.trim();
    if (!athleteId && body.email?.trim()) {
      const matches = await lookupAthletesByEmail(body.email);
      if (matches.length === 0) {
        return NextResponse.json({ success: false, error: 'No athlete found for email' }, { status: 404 });
      }
      if (matches.length > 1) {
        return NextResponse.json(
          {
            success: false,
            error: 'Multiple athletes match this email — pass athleteId explicitly',
            athletes: matches,
          },
          { status: 409 }
        );
      }
      athleteId = matches[0]!.athleteId;
    }

    if (!athleteId) {
      return NextResponse.json(
        { success: false, error: 'athleteId or email is required' },
        { status: 400 }
      );
    }

    if (body.email?.trim()) {
      const normalized = normalizeLeaderEmail(body.email);
      const matches = await lookupAthletesByEmail(normalized);
      const match = matches.find((a) => a.athleteId === athleteId);
      if (!match) {
        return NextResponse.json(
          { success: false, error: 'athleteId does not match email' },
          { status: 400 }
        );
      }
    }

    let state;
    if (action === 'deactivate') {
      state = await deactivateClubManagerAccess({ runClubId, athleteId });
    } else if (action === 'remove') {
      state = await removeAthleteFromClub({ runClubId, athleteId });
    } else {
      state = await assignClubManagerMembership({
        runClubId,
        athleteId,
        membershipRole: body.membershipRole,
        managerAssignmentId: body.managerAssignmentId ?? null,
      });
    }

    return NextResponse.json({
      success: true,
      action,
      membership: state,
    });
  } catch (err: unknown) {
    console.error('[POST /api/internal/run-club-leader-claims/assign]', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update manager membership',
        details: err instanceof Error ? err.message : 'Unknown',
      },
      { status: 500 }
    );
  }
}
