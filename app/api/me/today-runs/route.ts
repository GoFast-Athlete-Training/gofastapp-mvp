export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { fetchTodayRunsForAthlete } from '@/lib/runner/today-runs';

/** GET /api/me/today-runs — today's joined city runs + 24h were-you-there window (no plan week). */
export async function GET(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const payload = await fetchTodayRunsForAthlete(auth.athlete.id);
    return NextResponse.json(payload);
  } catch (err: unknown) {
    console.error('GET /api/me/today-runs:', err);
    return NextResponse.json(
      {
        error: 'Server error',
        details: err instanceof Error ? err.message : 'Unknown',
      },
      { status: 500 }
    );
  }
}
