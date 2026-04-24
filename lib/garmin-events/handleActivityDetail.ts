/**
 * Handle ACTIVITY_DETAIL webhook events
 * Hydrates athlete_activities.detailData for lap/sample-based evaluation.
 */

import { prisma } from "../prisma";
import { getAthleteByGarminUserId } from "../domain-garmin";
import { parseDetailData } from "../training/detail-data-parser";
import { convertLapsToDerived } from "../training/lap-converter";
import { writeLapsToWorkout } from "../training/lap-data-to-workout";

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
        console.warn("⚠️ No userId found in activity detail");
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
        console.warn("⚠️ No activityId found in activity detail");
        skipped++;
        continue;
      }

      const updateResult = await prisma.athlete_activities.updateMany({
        where: {
          athleteId: athlete.id,
          sourceActivityId: activityId,
        },
        data: {
          detailData: detail as object,
          hydratedAt: new Date(),
        },
      });

      if (updateResult.count > 0) {
        const row = await prisma.athlete_activities.findFirst({
          where: { athleteId: athlete.id, sourceActivityId: activityId },
        });
        if (row) {
          try {
            const parsed = parseDetailData(row.detailData);
            const derived = convertLapsToDerived(parsed.laps, parsed.samples);
            await writeLapsToWorkout(row.id, derived);
          } catch (lapErr) {
            console.warn("lap pipeline (detailData → workout):", lapErr);
          }
        }
        processed++;
      } else {
        skipped++;
        console.warn(`⚠️ Activity ${activityId} not found for detail update`);
      }
    } catch (error: any) {
      errors++;
      console.error(`❌ Error processing activity detail:`, error);
    }
  }

  return { processed, skipped, errors };
}
