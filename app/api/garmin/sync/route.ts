export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { refreshGarminToken } from '@/lib/garmin-refresh-token';
import { GarminNotConnectedError, requireGarminToken } from '@/lib/domain-garmin';
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
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

    const hasProd =
      !!(athlete.garmin_access_token?.trim()) && !!(athlete.garmin_user_id?.trim());
    if (!hasProd) {
      return NextResponse.json(
        { error: 'Garmin not connected' },
        { status: 400 }
      );
    }

    let accessToken: string;
    try {
      accessToken = await requireGarminToken(athlete.id);
    } catch (e) {
      if (e instanceof GarminNotConnectedError) {
        return NextResponse.json({ error: 'Garmin not connected' }, { status: 400 });
      }
      throw e;
    }

    const activitiesUrl = 'https://apis.garmin.com/wellness-api/rest/activities';

    /** Garmin Wellness API expects Unix seconds, not calendar startDate strings. */
    const uploadEndTimeInSeconds = Math.floor(Date.now() / 1000);
    const uploadStartTimeInSeconds = uploadEndTimeInSeconds - 30 * 24 * 60 * 60;

    const fetchActivities = (token: string) =>
      fetch(
        `${activitiesUrl}?uploadStartTimeInSeconds=${uploadStartTimeInSeconds}&uploadEndTimeInSeconds=${uploadEndTimeInSeconds}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

    let response = await fetchActivities(accessToken);

    if (response.status === 401) {
      const refreshed = await refreshGarminToken(athlete.id);
      if (!refreshed.success || !refreshed.accessToken) {
        return NextResponse.json(
          { error: 'Garmin session expired; reconnect Garmin' },
          { status: 401 }
        );
      }
      accessToken = refreshed.accessToken;
      response = await fetchActivities(accessToken);
    }

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
