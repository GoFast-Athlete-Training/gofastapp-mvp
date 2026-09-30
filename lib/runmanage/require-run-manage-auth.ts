import { NextRequest, NextResponse } from 'next/server';
import {
  assertStaffBearerAuth,
  getForwardedStaffId,
} from '@/lib/training/training-engine-auth';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { athleteHasProductRole } from '@/lib/athlete-product-roles';

export type RunManageAuthContext =
  | { mode: 'staff'; staffId: string }
  | { mode: 'athlete'; athleteId: string; staffGeneratedId: string | null };

/**
 * HQ staff proxy lane OR runmanage athlete with RUN_MANAGER product role.
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
  const hasRole = await athleteHasProductRole(athleteId, 'RUN_MANAGER');
  if (!hasRole) {
    return NextResponse.json(
      { success: false, error: 'Run Manage access required' },
      { status: 403 }
    );
  }

  const grant = await prismaRunManagerGrantByAthlete(athleteId);

  return {
    mode: 'athlete',
    athleteId,
    staffGeneratedId: grant?.id ?? null,
  };
}

async function prismaRunManagerGrantByAthlete(athleteId: string) {
  const { prisma } = await import('@/lib/prisma');
  return prisma.run_manager_grants.findFirst({
    where: { athleteId, status: 'active' },
    select: { id: true },
  });
}

export function staffGeneratedIdFromAuth(ctx: RunManageAuthContext): string | null {
  if (ctx.mode === 'staff') return ctx.staffId;
  return ctx.staffGeneratedId;
}
