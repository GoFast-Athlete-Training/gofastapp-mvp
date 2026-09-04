export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { fetchMyDayForAthlete } from '@/lib/runner/today-runs';

/** GET /api/me/my-day — planned + going + hosted widgets (not merged). */
export async function GET(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const payload = await fetchMyDayForAthlete(auth.athlete.id);
    return NextResponse.json(payload);
  } catch (err: unknown) {
    console.error('GET /api/me/my-day:', err);
    return NextResponse.json(
      {
        error: 'Server error',
        details: err instanceof Error ? err.message : 'Unknown',
      },
      { status: 500 }
    );
  }
}
