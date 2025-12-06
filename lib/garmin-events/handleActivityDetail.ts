/**
 * Handle ACTIVITY_DETAIL webhook events
 * Processes detailed activity data from Garmin
 */

import { prisma } from '../prisma';
import { getAthleteByGarminUserId } from '../domain-garmin';

export interface ActivityDetail {
  activityId: string | number;
  userId?: string;
  [key: string]: any;
}

/**
 * Process activity detail webhook
 */
export async function handleActivityDetail(
  activityDetails: ActivityDetail[],
  userId?: string
): Promise<{ processed: number; skipped: number; errors: number }> {
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const detail of activityDetails) {
    try {
      const garminUserId = userId || detail.userId;
      if (!garminUserId) {
        console.warn('⚠️ No userId found in activity detail');
        skipped++;
        continue;
      }

      const athlete = await getAthleteByGarminUserId(garminUserId);
      if (!athlete) {
        console.warn(`⚠️ Athlete not found for Garmin userId: ${garminUserId}`);
        skipped++;
        continue;
      }

      const activityId = detail.activityId?.toString();
      if (!activityId) {
        console.warn('⚠️ No activityId found in activity detail');
        skipped++;
        continue;
      }

      // TODO: Activities will be reintroduced in Schema Phase 3
      // Update existing activity with detail data
      // const updateResult = await prisma.athleteActivity.updateMany({
      //   where: {
      //     athleteId: athlete.id,
      //     sourceActivityId: activityId
      //   },
      //   data: {
      //     detailData: detail,
      //     hydratedAt: new Date()
      //   }
      // });

      // if (updateResult.count > 0) {
      //   processed++;
      //   console.log(`✅ Activity detail ${activityId} updated for athlete ${athlete.id}`);
      // } else {
      //   skipped++;
      //   console.warn(`⚠️ Activity ${activityId} not found, skipping detail update`);
      // }
      skipped++;

    } catch (error: any) {
      errors++;
      console.error(`❌ Error processing activity detail:`, error);
    }
  }

  return { processed, skipped, errors };
}

