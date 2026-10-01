export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import {
  athleteHasRunManagerAccess,
  getRunManagerAccessForAthlete,
  staffGeneratedIdFromAccessRow,
} from '@/lib/domain-run-manager-access';

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
  const access = await getRunManagerAccessForAthlete(athleteId);

  return NextResponse.json({
    success: true,
    hasAccess,
    staffGeneratedId: access ? staffGeneratedIdFromAccessRow(access) : null,
    access,
  });
}
