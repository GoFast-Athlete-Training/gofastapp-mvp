export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { fetchRunnerAgendaForAthlete } from '@/lib/runner/runner-agenda';

/** GET /api/me/runner — personal run agenda: plan sessions + joined runs + check-in state */
export async function GET(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { athlete } = auth;

  try {
    const { searchParams } = new URL(request.url);
    const todayKey = searchParams.get('todayKey')?.trim() || undefined;
    const agenda = await fetchRunnerAgendaForAthlete(athlete.id, { todayKey });
    return NextResponse.json(agenda);
  } catch (err: unknown) {
    console.error('GET /api/me/runner:', err);
    return NextResponse.json(
      { error: 'Server error', details: err instanceof Error ? err.message : 'Unknown' },
      { status: 500 }
    );
  }
}
