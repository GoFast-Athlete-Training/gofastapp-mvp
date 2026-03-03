export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/activities
 *
 * Returns the authenticated athlete's activity stream (from athlete_activities).
 * Used by the /activities page as the single source of truth for the list.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const athlete = await getAthleteByFirebaseId(decodedToken.uid);
    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const activities = await prisma.athlete_activities.findMany({
      where: {
        athleteId: athlete.id,
        startTime: { gte: ninetyDaysAgo },
      },
      orderBy: { startTime: 'desc' },
      take: 200,
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
