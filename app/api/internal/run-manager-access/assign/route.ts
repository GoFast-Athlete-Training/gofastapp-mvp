export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { lookupAthletesByEmail } from '@/lib/domain-club-manager-staff-assign';
import {
  normalizeRunManagerEmail,
  revokeRunManagerAccess,
  upsertRunManagerAccessForEmail,
} from '@/lib/domain-run-manager-access';
import { assertStaffBearerAuth, getForwardedStaffId } from '@/lib/training/training-engine-auth';

type AssignBody = {
  action?: 'assign' | 'revoke';
  /** Legacy name — same as accessId */
  staffId?: string;
  accessId?: string;
  athleteId?: string;
  email?: string;
  displayName?: string | null;
  managerAssignmentId?: string | null;
};

/**
 * POST /api/internal/run-manager-access/assign
 * Admin → Product: run_manager_access row (not athlete_product_roles).
 */
export async function POST(request: NextRequest) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  const assignedByStaffId = getForwardedStaffId(request);

  try {
    const body = (await request.json()) as AssignBody;
    const action = body.action ?? 'assign';
    const accessId = (body.accessId ?? body.staffId)?.trim();

    if (action === 'revoke') {
      if (!accessId) {
        return NextResponse.json({ success: false, error: 'accessId is required' }, { status: 400 });
      }
      const revoked = await revokeRunManagerAccess(accessId);
      return NextResponse.json({ success: true, action, access: revoked, grant: revoked });
    }

    const emailRaw = body.email?.trim();
    if (!emailRaw) {
      return NextResponse.json({ success: false, error: 'email is required' }, { status: 400 });
    }
    const email = normalizeRunManagerEmail(emailRaw);
    if (!email) {
      return NextResponse.json({ success: false, error: 'email is invalid' }, { status: 400 });
    }

    let athleteId = body.athleteId?.trim() || null;
    if (!athleteId) {
      const matches = await lookupAthletesByEmail(email);
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
      if (matches.length === 1) {
        athleteId = matches[0]!.athleteId;
      }
    }

    const { access, alreadyAssigned } = await upsertRunManagerAccessForEmail({
      email,
      athleteId,
      displayName: body.displayName,
      managerAssignmentId: body.managerAssignmentId ?? null,
      assignedByStaffId,
    });

    return NextResponse.json({
      success: true,
      action: 'assign',
      access,
      grant: access,
      athleteId: access.athleteId,
      alreadyAssigned,
      welcomeUrl: '/welcome-runmanage',
    });
  } catch (err: unknown) {
    console.error('[POST /api/internal/run-manager-access/assign]', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update run manager access',
        details: err instanceof Error ? err.message : 'Unknown',
      },
      { status: 500 }
    );
  }
}
