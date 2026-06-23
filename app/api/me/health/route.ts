export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { buildHealthHydration } from '@/lib/garmin-health/athlete-health-records';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';

/** GET /api/me/health — latest Garmin daily + sleep for /health page (web + mobile). */
export async function GET(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const health = await buildHealthHydration(auth.athlete.id);

  return NextResponse.json({
    success: true,
    ...health,
  });
}
