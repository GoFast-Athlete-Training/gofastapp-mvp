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
  activityId: string | number;
  userId?: string;
  activityType?: string;
  activityName?: string;
  startTime?: string | number;
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

      const sourceActivityId = activity.activityId?.toString();
      if (!sourceActivityId) {
        console.warn('⚠️ No activityId found in activity summary');
        skipped++;
        continue;
      }

      if (await activityExists(sourceActivityId)) {
        skipped++;
        continue;
      }

      const now = new Date();
      const startTime = activity.startTime
        ? new Date(typeof activity.startTime === 'string' ? activity.startTime : (activity.startTime as number) * 1000)
        : null;

      await prisma.athlete_activities.create({
        data: {
          id: generateId(),
          athleteId: athlete.id,
          sourceActivityId,
          source: 'garmin',
          activityType: activity.activityType ?? undefined,
          activityName: activity.activityName ?? undefined,
          startTime,
          duration: activity.duration != null ? Math.round(Number(activity.duration)) : undefined,
          distance: activity.distance != null ? Number(activity.distance) : undefined,
          calories: activity.calories != null ? Math.round(Number(activity.calories)) : undefined,
          averageSpeed: activity.averageSpeed != null ? Number(activity.averageSpeed) : undefined,
          averageHeartRate: activity.averageHeartRate != null ? Math.round(Number(activity.averageHeartRate)) : undefined,
          maxHeartRate: activity.maxHeartRate != null ? Math.round(Number(activity.maxHeartRate)) : undefined,
          elevationGain: activity.elevationGain != null ? Number(activity.elevationGain) : undefined,
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

