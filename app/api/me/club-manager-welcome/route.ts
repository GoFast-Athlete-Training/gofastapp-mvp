export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { buildLeaderContext } from '@/lib/run-club-leader-context';
import { updateAthlete, getAthleteById } from '@/lib/domain-athlete';
import {
  mergeClubManagerWelcomeAck,
  parseClubManagerState,
} from '@/lib/club-manager-state';
import { resolveClubManagerHomePath } from '@/lib/club-manager-home-route';

/**
 * POST /api/me/club-manager-welcome
 * Persist first-ack for manager clubs (welcome UX gate — not membership write).
 */
export async function POST(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const leaderContext = await buildLeaderContext(auth.athlete.id);
    const clubs = leaderContext?.clubs ?? [];
    if (clubs.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No club manager memberships found' },
        { status: 403 }
      );
    }

    const athleteRow = await getAthleteById(auth.athlete.id);
    if (!athleteRow) {
      return NextResponse.json({ success: false, error: 'Athlete not found' }, { status: 404 });
    }

    const existing = parseClubManagerState(
      (athleteRow as { clubManagerState?: unknown }).clubManagerState
    );
    const nextState = mergeClubManagerWelcomeAck(existing, clubs);

    await updateAthlete(auth.athlete.id, { clubManagerState: nextState });

    const homePath = resolveClubManagerHomePath(clubs);

    return NextResponse.json({
      success: true,
      clubManagerState: nextState,
      homePath,
    });
  } catch (err: unknown) {
    console.error('[POST /api/me/club-manager-welcome]', err);
    return NextResponse.json(
      { success: false, error: 'Failed to save welcome acknowledgment' },
      { status: 500 }
    );
  }
}
