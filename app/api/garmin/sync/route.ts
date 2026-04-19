export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAthleteFromBearer } from '@/lib/training/require-athlete';
import { refreshGarminToken } from '@/lib/garmin-refresh-token';
import { GarminNotConnectedError, requireGarminToken } from '@/lib/domain-garmin';
import { prisma } from '@/lib/prisma';
import { activityExists } from '@/lib/garmin-events/dedupe';
import { normalizeActivityFields } from '@/lib/garmin-events/normalizeActivityFields';
import { tryMatchActivityToTrainingWorkout } from '@/lib/training/match-activity-to-workout';
import { utcDateOnly, ymdFromDate } from '@/lib/training/plan-utils';
import { parseUtcYmdToUploadWindow } from '@/lib/garmin-events/garmin-upload-window-utc';

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

/**
 * POST /api/garmin/sync
 *
 * Body (optional JSON): { "date": "YYYY-MM-DD" } — UTC calendar day for upload-time window (max 86400s per Garmin).
 * Omitted date defaults to today UTC (same convention as training plan date keys).
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

    let bodyDate: string | undefined;
    try {
      const body = (await request.json()) as { date?: unknown };
      if (body && typeof body.date === 'string' && body.date.trim()) {
        bodyDate = body.date.trim();
      }
    } catch {
      /* empty or non-JSON body */
    }

    const ymd = bodyDate ?? ymdFromDate(utcDateOnly(new Date()));
    const window = parseUtcYmdToUploadWindow(ymd);
    if (!window) {
      return NextResponse.json(
        { error: 'Invalid date; use YYYY-MM-DD (UTC calendar day).' },
        { status: 400 }
      );
    }

    const { uploadStartTimeInSeconds, uploadEndTimeInSeconds, dateUtc } = window;

    const activitiesUrl = 'https://apis.garmin.com/wellness-api/rest/activities';

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
      let message = errorText;
      try {
        const j = JSON.parse(errorText) as { errorMessage?: string };
        if (j.errorMessage) message = j.errorMessage;
      } catch {
        /* keep raw */
      }
      return NextResponse.json(
        { error: message || `Failed to fetch activities: ${response.status}` },
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
            ingestionStatus: 'RECEIVED',
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
        console.log('✅ sync: athlete_activity created', {
          id: created.id,
          sourceActivityId,
          activityType: activity.activityType,
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
      window: {
        dateUtc,
        uploadStartTimeInSeconds,
        uploadEndTimeInSeconds
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
