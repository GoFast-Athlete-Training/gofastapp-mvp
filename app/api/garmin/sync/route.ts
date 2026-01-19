export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import { getValidAccessToken } from '@/lib/garmin-refresh-token';
import { prisma } from '@/lib/prisma';

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

    // TODO: Activities will be reintroduced in Schema Phase 3
    // 5. Process and save activities
    let saved = 0;
    let skipped = 0;
    let errors = 0;

    // TODO: Re-enable activity saving when AthleteActivity model is reintroduced
    // for (const activity of activities) {
    //   try {
    //     const sourceActivityId = activity.activityId?.toString() || activity.id?.toString();
    //     
    //     if (!sourceActivityId) {
    //       skipped++;
    //       continue;
    //     }

    //     // Check if already exists
    //     const existing = await prisma.athleteActivity.findUnique({
    //       where: { sourceActivityId }
    //     });

    //     if (existing) {
    //       skipped++;
    //       continue;
    //     }

    //     // Create activity record
    //     await prisma.athleteActivity.create({
    //       data: {
    //         athleteId: athlete.id,
    //         sourceActivityId,
    //         source: 'garmin',
    //         activityType: activity.activityType,
    //         activityName: activity.activityName,
    //         startTime: activity.startTime ? new Date(activity.startTime) : null,
    //         duration: activity.duration,
    //         distance: activity.distance,
    //         calories: activity.calories,
    //         averageSpeed: activity.averageSpeed,
    //         averageHeartRate: activity.averageHeartRate,
    //         maxHeartRate: activity.maxHeartRate,
    //         elevationGain: activity.elevationGain,
    //         steps: activity.steps,
    //         summaryData: activity
    //       }
    //     });

    //     saved++;

    //   } catch (error: any) {
    //     errors++;
    //     console.error(`❌ Error saving activity:`, error);
    //   }
    // }

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

