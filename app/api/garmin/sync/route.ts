export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { getValidAccessToken } from '@/lib/garmin-refresh-token';
import { prisma } from '@/lib/prisma';
import { activityExists } from '@/lib/garmin-events/dedupe';
import { normalizeActivityFields } from '@/lib/garmin-events/normalizeActivityFields';
import { tryMatchActivityToTrainingWorkout } from '@/lib/training/match-activity-to-workout';

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

/**
 * POST /api/garmin/sync
 * 
 * Manual sync endpoint for pulling recent activities from Garmin.
 * Useful for debugging and user-facing "Sync Now" buttons.
 */
export async function POST(request: Request) {
  try {
    // 1. Authenticate user
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

    // 2. Get athlete
    const athlete = await getAthleteByFirebaseId(decodedToken.uid);
    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    if (!athlete.garmin_is_connected || !athlete.garmin_user_id) {
      return NextResponse.json(
        { error: 'Garmin not connected' },
        { status: 400 }
      );
    }

    // 3. Get valid access token (refresh if needed)
    const accessToken = await getValidAccessToken(athlete.id);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Failed to get valid access token' },
        { status: 500 }
      );
    }

    // 4. Fetch activities from Garmin API
    // Garmin Wellness API endpoint for activities
    const activitiesUrl = 'https://apis.garmin.com/wellness-api/rest/activities';
    
    // Get activities from last 30 days (more historical data)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const startDateStr = startDate.toISOString().split('T')[0];
    console.log(`🔍 [SYNC] Fetching activities from ${startDateStr} (last 30 days)`);

    const response = await fetch(
      `${activitiesUrl}?startDate=${startDateStr}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Garmin activities fetch failed:', response.status, errorText);
      return NextResponse.json(
        { error: `Failed to fetch activities: ${response.status}` },
        { status: response.status }
      );
    }

    const activities = await response.json();
    
    if (!Array.isArray(activities)) {
      return NextResponse.json(
        { error: 'Invalid response format from Garmin' },
        { status: 500 }
      );
    }

    // 5. Process and save activities to athlete_activities
    let saved = 0;
    let skipped = 0;
    let errors = 0;
    const now = new Date();

    for (const activity of activities) {
      try {
        const sourceActivityId = activity.activityId?.toString() || activity.id?.toString();
        if (!sourceActivityId) {
          skipped++;
          continue;
        }
        if (await activityExists(sourceActivityId)) {
          skipped++;
          continue;
        }
        const norm = normalizeActivityFields(activity);

        const created = await prisma.athlete_activities.create({
          data: {
            id: generateId(),
            athleteId: athlete.id,
            sourceActivityId,
            source: 'garmin',
            activityType: activity.activityType ?? undefined,
            activityName: activity.activityName ?? undefined,
            startTime: norm.startTime,
            duration: norm.duration,
            distance: norm.distance,
            calories: norm.calories,
            averageSpeed: norm.averageSpeed,
            averageHeartRate: norm.averageHeartRate,
            maxHeartRate: norm.maxHeartRate,
            elevationGain: norm.elevationGain,
            steps: norm.steps,
            summaryData: activity as object,
            updatedAt: now,
          },
        });
        try {
          await tryMatchActivityToTrainingWorkout(created.id);
        } catch (matchErr) {
          console.warn('tryMatchActivityToTrainingWorkout:', matchErr);
        }
        saved++;
      } catch (error: any) {
        errors++;
        console.error('❌ Error saving activity:', error);
      }
    }

    // 6. Update last sync time
    await prisma.athlete.update({
      where: { id: athlete.id },
      data: {
        garmin_last_sync_at: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      summary: {
        fetched: activities.length,
        saved,
        skipped,
        errors
      },
      message: `Synced ${saved} new activities`
    });

  } catch (error: any) {
    console.error('❌ Sync error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: error.message },
      { status: 500 }
    );
  }
}

