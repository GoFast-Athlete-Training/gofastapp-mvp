/**
 * Handle ACTIVITY_SUMMARY webhook events
 * Processes activity summary data from Garmin
 */

import { prisma } from '../prisma';
import { getAthleteByGarminUserId } from '../domain-garmin';
import { activityExists } from './dedupe';

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

      // Check for duplicates
      if (await activityExists(sourceActivityId)) {
        console.log(`⏭️ Activity ${sourceActivityId} already exists, skipping`);
        skipped++;
        continue;
      }

      // Create activity record
      await prisma.athleteActivity.create({
        data: {
          athleteId: athlete.id,
          sourceActivityId,
          source: 'garmin',
          activityType: activity.activityType,
          activityName: activity.activityName,
          startTime: activity.startTime 
            ? new Date(typeof activity.startTime === 'string' ? activity.startTime : activity.startTime * 1000)
            : null,
          duration: activity.duration,
          distance: activity.distance,
          calories: activity.calories,
          averageSpeed: activity.averageSpeed,
          averageHeartRate: activity.averageHeartRate,
          maxHeartRate: activity.maxHeartRate,
          elevationGain: activity.elevationGain,
          steps: activity.steps,
          summaryData: activity
        }
      });

      processed++;
      console.log(`✅ Activity ${sourceActivityId} saved for athlete ${athlete.id}`);

    } catch (error: any) {
      errors++;
      console.error(`❌ Error processing activity summary ${activity.activityId}:`, error);
    }
  }

  return { processed, skipped, errors };
}

