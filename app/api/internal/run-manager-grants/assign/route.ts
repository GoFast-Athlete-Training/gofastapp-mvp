export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { lookupAthletesByEmail } from '@/lib/domain-club-manager-staff-assign';
import {
  assignRunManagerToAthlete,
  normalizeRunManagerEmail,
  revokeRunManagerGrant,
  seedRunManagerGrantStub,
} from '@/lib/domain-run-manager-grant';
import { assertStaffBearerAuth, getForwardedStaffId } from '@/lib/training/training-engine-auth';

type AssignBody = {
  action?: 'assign' | 'invite' | 'revoke';
  staffId?: string;
  athleteId?: string;
  email?: string;
  displayName?: string | null;
  managerAssignmentId?: string | null;
};

/**
 * POST /api/internal/run-manager-grants/assign
 * Admin / Company → Product: run manager grant + RUN_MANAGER role.
 */
export async function POST(request: NextRequest) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  const assignedByStaffId = getForwardedStaffId(request);

  try {
    const body = (await request.json()) as AssignBody;
    const staffId = body.staffId?.trim();
    const action = body.action ?? 'assign';

    if (!staffId) {
      return NextResponse.json({ success: false, error: 'staffId is required' }, { status: 400 });
    }

    if (action === 'revoke') {
      const revoked = await revokeRunManagerGrant(staffId);
      return NextResponse.json({ success: true, action, grant: revoked });
    }

    const emailRaw = body.email?.trim();
    if (!emailRaw) {
      return NextResponse.json({ success: false, error: 'email is required' }, { status: 400 });
    }
    const email = normalizeRunManagerEmail(emailRaw);
    if (!email) {
      return NextResponse.json({ success: false, error: 'email is invalid' }, { status: 400 });
    }

    if (action === 'invite') {
      const grant = await seedRunManagerGrantStub({
        staffId,
        email,
        displayName: body.displayName,
        managerAssignmentId: body.managerAssignmentId ?? null,
        assignedByStaffId,
      });
      return NextResponse.json({
        success: true,
        action: 'invite',
        grant,
        welcomeUrl: '/welcome-runmanage',
      });
    }

    let athleteId = body.athleteId?.trim();
    if (!athleteId) {
      const matches = await lookupAthletesByEmail(email);
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

    const grant = await assignRunManagerToAthlete({
      staffId,
      athleteId,
      email,
      displayName: body.displayName,
      managerAssignmentId: body.managerAssignmentId ?? null,
      assignedByStaffId,
    });

    return NextResponse.json({
      success: true,
      action: 'assign',
      grant,
      athleteId,
      welcomeUrl: '/welcome-runmanage',
    });
  } catch (err: unknown) {
    console.error('[POST /api/internal/run-manager-grants/assign]', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update run manager grant',
        details: err instanceof Error ? err.message : 'Unknown',
      },
      { status: 500 }
    );
  }
}
