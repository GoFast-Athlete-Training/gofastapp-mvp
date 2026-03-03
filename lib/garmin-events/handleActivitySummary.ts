/**
 * Handle ACTIVITY_SUMMARY webhook events
 * Processes activity summary data from Garmin and stores in athlete_activities.
 */

import { prisma } from '../prisma';
import { getAthleteByGarminUserId } from '../domain-garmin';
import { activityExists } from './dedupe';

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

export interface ActivitySummary {
  activityId?: string | number;
  summaryId?: string | number; // Garmin sometimes sends this instead of/in addition to activityId
  userId?: string;
  activityType?: string;
  activityName?: string;
  startTime?: string | number;
  startTimeInSeconds?: number; // Garmin PUSH uses Unix seconds
  startTimeOffsetInSeconds?: number;
  duration?: number;
  distance?: number;
  calories?: number;
  averageSpeed?: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
  elevationGain?: number;
  steps?: number;
  [key: string]: any;
}

/**
 * Process activity summary webhook
 */
export async function handleActivitySummary(
  activities: ActivitySummary[],
  userId?: string
): Promise<{ processed: number; skipped: number; errors: number }> {
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const activity of activities) {
    try {
      const garminUserId = userId || activity.userId;
      if (!garminUserId) {
        console.warn('⚠️ No userId found in activity summary');
        skipped++;
        continue;
      }

      // Find athlete by Garmin user ID
      const athlete = await getAthleteByGarminUserId(garminUserId);
      if (!athlete) {
        console.warn(`⚠️ Athlete not found for Garmin userId: ${garminUserId}`);
        skipped++;
        continue;
      }

      const sourceActivityId = (activity.activityId ?? activity.summaryId)?.toString();
      if (!sourceActivityId) {
        console.warn('⚠️ No activityId/summaryId found in activity summary');
        skipped++;
        continue;
      }

      if (await activityExists(sourceActivityId)) {
        skipped++;
        continue;
      }

      const now = new Date();
      const startTimeRaw = activity.startTime ?? activity.startTimeInSeconds;
      const startTime = startTimeRaw != null
        ? new Date(
            typeof startTimeRaw === 'string'
              ? startTimeRaw
              : (startTimeRaw as number) < 1e12
                ? (startTimeRaw as number) * 1000
                : (startTimeRaw as number)
          )
        : null;

      // Normalize Garmin Data Generator / API field names into our schema (accept both styles)
      const duration =
        activity.duration != null ? Number(activity.duration)
        : (activity as any).durationInSeconds != null ? Number((activity as any).durationInSeconds)
        : undefined;
      const distance =
        activity.distance != null ? Number(activity.distance)
        : (activity as any).distanceInMeters != null ? Number((activity as any).distanceInMeters)
        : undefined;
      const calories =
        activity.calories != null ? Number(activity.calories)
        : (activity as any).activeKilocalories != null ? Math.round(Number((activity as any).activeKilocalories))
        : undefined;
      const averageSpeed =
        activity.averageSpeed != null ? Number(activity.averageSpeed)
        : (activity as any).averageSpeedInMetersPerSecond != null ? Number((activity as any).averageSpeedInMetersPerSecond)
        : undefined;
      const averageHeartRate =
        activity.averageHeartRate != null ? Number(activity.averageHeartRate)
        : (activity as any).averageHeartRateInBeatsPerMinute != null ? Math.round(Number((activity as any).averageHeartRateInBeatsPerMinute))
        : undefined;
      const maxHeartRate =
        activity.maxHeartRate != null ? Number(activity.maxHeartRate)
        : (activity as any).maxHeartRateInBeatsPerMinute != null ? Math.round(Number((activity as any).maxHeartRateInBeatsPerMinute))
        : undefined;
      const elevationGain =
        activity.elevationGain != null ? Number(activity.elevationGain)
        : (activity as any).totalElevationGainInMeters != null ? Number((activity as any).totalElevationGainInMeters)
        : undefined;

      await prisma.athlete_activities.create({
        data: {
          id: generateId(),
          athleteId: athlete.id,
          sourceActivityId,
          source: 'garmin',
          activityType: activity.activityType ?? undefined,
          activityName: activity.activityName ?? undefined,
          startTime,
          duration: duration != null ? Math.round(duration) : undefined,
          distance: distance ?? undefined,
          calories: calories ?? undefined,
          averageSpeed: averageSpeed ?? undefined,
          averageHeartRate: averageHeartRate ?? undefined,
          maxHeartRate: maxHeartRate ?? undefined,
          elevationGain: elevationGain ?? undefined,
          steps: activity.steps != null ? Math.round(Number(activity.steps)) : undefined,
          summaryData: activity as object,
          updatedAt: now,
        },
      });

      processed++;

    } catch (error: any) {
      errors++;
      console.error(`❌ Error processing activity summary ${activity.activityId}:`, error);
    }
  }

  return { processed, skipped, errors };
}

