import { NextRequest, NextResponse } from 'next/server';
import {
  assertStaffBearerAuth,
  getForwardedStaffId,
} from '@/lib/training/training-engine-auth';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import {
  athleteHasRunManagerAccess,
  getRunManagerAccessForAthlete,
  staffGeneratedIdFromAccessRow,
} from '@/lib/domain-run-manager-access';

export type RunManageAuthContext =
  | { mode: 'staff'; staffId: string }
  | { mode: 'athlete'; athleteId: string; staffGeneratedId: string | null };

/**
 * HQ staff proxy lane OR runmanage athlete with active run_manager_access.
 */
export async function assertRunManageAuth(
  request: NextRequest
): Promise<RunManageAuthContext | NextResponse> {
  const staffErr = await assertStaffBearerAuth(request);
  if (!staffErr) {
    const staffId = getForwardedStaffId(request);
    if (!staffId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return { mode: 'staff', staffId };
  }

  const athleteResult = await requireAthleteFromBearer(request);
  if ('error' in athleteResult) {
    return NextResponse.json(
      { success: false, error: athleteResult.error },
      { status: athleteResult.status }
    );
  }

  const athleteId = athleteResult.athlete.id;
  const hasAccess = await athleteHasRunManagerAccess(athleteId);
  if (!hasAccess) {
    return NextResponse.json(
      { success: false, error: 'Run Manage access required' },
      { status: 403 }
    );
  }

  const access = await getRunManagerAccessForAthlete(athleteId);

  return {
    mode: 'athlete',
    athleteId,
    staffGeneratedId: access ? staffGeneratedIdFromAccessRow(access) : null,
  };
}

export function staffGeneratedIdFromAuth(ctx: RunManageAuthContext): string | null {
  if (ctx.mode === 'staff') return ctx.staffId;
  return ctx.staffGeneratedId;
}
