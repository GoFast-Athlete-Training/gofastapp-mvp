/**
 * Handle ACTIVITY_FILE webhook events
 * Processes activity file uploads from Garmin
 */

import { prisma } from '../prisma';
import { getAthleteByGarminUserId } from '../domain-garmin';
import { activityFileExists, markActivityFileProcessed } from './dedupe';

export interface ActivityFile {
  activityId: string | number;
  userId?: string;
  fileType?: string;
  fileUrl?: string;
  fileData?: any;
  [key: string]: any;
}

/**
 * Process activity file webhook
 */
export async function handleActivityFile(
  files: ActivityFile[],
  userId?: string
): Promise<{ processed: number; skipped: number; errors: number }> {
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of files) {
    try {
      const garminUserId = userId || file.userId;
      if (!garminUserId) {
        console.warn('⚠️ No userId found in activity file');
        skipped++;
        continue;
      }

      const athlete = await getAthleteByGarminUserId(garminUserId);
      if (!athlete) {
        console.warn(`⚠️ Athlete not found for Garmin userId: ${garminUserId}`);
        skipped++;
        continue;
      }

      const activityId = file.activityId?.toString();
      const fileType = file.fileType || 'unknown';
      
      if (!activityId) {
        console.warn('⚠️ No activityId found in activity file');
        skipped++;
        continue;
      }

      // Check if file already processed
      if (await activityFileExists(activityId, fileType)) {
        console.log(`⏭️ File ${fileType} for activity ${activityId} already processed`);
        skipped++;
        continue;
      }

      // Update activity with file data
      const activity = await prisma.athleteActivity.findUnique({
        where: { sourceActivityId: activityId }
      });

      if (!activity) {
        console.warn(`⚠️ Activity ${activityId} not found for file processing`);
        skipped++;
        continue;
      }

      const detailData = (activity.detailData || {}) as any;
      const files = detailData.files || [];

      // Add file to files array
      files.push({
        type: fileType,
        url: file.fileUrl,
        data: file.fileData,
        processedAt: new Date().toISOString()
      });

      await prisma.athleteActivity.update({
        where: { sourceActivityId: activityId },
        data: {
          detailData: {
            ...detailData,
            files
          }
        }
      });

      // Mark as processed
      await markActivityFileProcessed(activityId, fileType);

      processed++;
      console.log(`✅ Activity file ${fileType} for ${activityId} processed`);

    } catch (error: any) {
      errors++;
      console.error(`❌ Error processing activity file:`, error);
    }
  }

  return { processed, skipped, errors };
}

