export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/activities
 *
 * Returns the authenticated athlete's activity stream (from athlete_activities).
 * Used by the /activities page as the single source of truth for the list.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitRaw = searchParams.get('limit');
    const take = Math.min(
      200,
      Math.max(1, limitRaw ? parseInt(limitRaw, 10) || 200 : 200)
    );

    const auth = await requireAthleteFromBearer(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const activities = await prisma.athlete_activities.findMany({
      where: {
        athleteId: athlete.id,
        OR: [
          { startTime: null },
          { startTime: { gte: ninetyDaysAgo } },
        ],
      },
      orderBy: { startTime: 'desc' },
      take,
      select: {
        id: true,
        sourceActivityId: true,
        source: true,
        activityType: true,
        activityName: true,
        startTime: true,
        duration: true,
        distance: true,
        calories: true,
        averageSpeed: true,
        averageHeartRate: true,
        elevationGain: true,
      },
    });

    return NextResponse.json({
      activities,
    });
  } catch (error: any) {
    console.error('❌ GET /api/activities:', error);
    return NextResponse.json(
      { error: 'Failed to load activities', details: error.message },
      { status: 500 }
    );
  }
}
