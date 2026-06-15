export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { getUpcomingClubRunReminderForAthlete } from '@/lib/club-run-reminders';

/** GET /api/me/upcoming-club-run-reminders */
export async function GET(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const reminder = await getUpcomingClubRunReminderForAthlete(auth.athlete.id);
  return NextResponse.json({ reminder });
}
