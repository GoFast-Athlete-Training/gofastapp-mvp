export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { prisma } from '@/lib/prisma';
import { hostedRunCountToStars } from '@/lib/host-run-rsvp';

/**
 * GET /api/me/hosted-runs-stats
 * Count of completed hosted runs (INDIVIDUAL + host checked in) and star tier.
 */
export async function GET(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { athlete } = auth;

  try {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const completedCount = await prisma.city_runs.count({
      where: {
        athleteGeneratedId: athlete.id,
        cityRunType: 'INDIVIDUAL',
        date: { lt: startOfToday },
        city_run_checkins: {
          some: { athleteId: athlete.id },
        },
      },
    });

    const stars = hostedRunCountToStars(completedCount);

    return NextResponse.json({
      success: true,
      completedHostedRuns: completedCount,
      stars,
    });
  } catch (err) {
    console.error('GET /api/me/hosted-runs-stats:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
