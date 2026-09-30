export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { athleteHasRunManagerAccess } from '@/lib/domain-run-manager-grant';
import { prisma } from '@/lib/prisma';

/** GET /api/me/run-manage-access — athlete session gate for welcome-runmanage */
export async function GET(request: NextRequest) {
  const athleteResult = await requireAthleteFromBearer(request);
  if ('error' in athleteResult) {
    return NextResponse.json(
      { success: false, error: athleteResult.error },
      { status: athleteResult.status }
    );
  }

  const athleteId = athleteResult.athlete.id;
  const hasAccess = await athleteHasRunManagerAccess(athleteId);

  const grant = await prisma.run_manager_grants.findFirst({
    where: { athleteId, status: 'active' },
    select: { id: true, email: true, displayName: true },
  });

  return NextResponse.json({
    success: true,
    hasAccess,
    staffGeneratedId: grant?.id ?? null,
    grant,
  });
}
