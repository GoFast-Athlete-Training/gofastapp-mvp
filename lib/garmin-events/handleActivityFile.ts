/**
 * Handle ACTIVITY_FILE webhook events
 * Downloads Garmin FIT files, decodes lap structure, persists fitLapData.
 */

import { prisma } from '../prisma';
import { getAthleteByGarminUserId } from '../domain-garmin';
import {
  activityFileAlreadyProcessed,
  activityFileExists,
} from './dedupe';
import { downloadGarminFitFile } from './download-garmin-fit-file';
import type { FitLapDataPayload } from './fit-lap-types';
import { findActivityRowForFit } from './match-activity-for-fit';
import { parseFitActivityLaps } from './parse-fit-activity-laps';

export interface ActivityFile {
  activityId?: string | number;
  userId?: string;
  fileType?: string;
  fileUrl?: string;
  callbackURL?: string;
  summaryId?: string;
  [key: string]: unknown;
}

function readDownloadUrl(file: ActivityFile): string | null {
  const callback =
    typeof file.callbackURL === 'string' && file.callbackURL.length > 0
      ? file.callbackURL
      : null;
  const legacy =
    typeof file.fileUrl === 'string' && file.fileUrl.length > 0 ? file.fileUrl : null;
  return callback ?? legacy;
}

function readCandidateActivityId(file: ActivityFile): string | null {
  if (file.activityId != null && String(file.activityId).length > 0) {
    return String(file.activityId);
  }
  if (typeof file.summaryId === 'string' && file.summaryId.endsWith('-detail')) {
    return file.summaryId.slice(0, -'-detail'.length);
  }
  return null;
}

function isFitFileType(fileType: string | undefined): boolean {
  return String(fileType ?? '').trim().toUpperCase() === 'FIT';
}

/**
 * Process activity file webhook (FIT only in this pass).
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
      const fileType = String(file.fileType ?? 'unknown').trim();
      if (!isFitFileType(fileType)) {
        console.log(`⏭️ Skipping non-FIT activity file type: ${fileType}`);
        skipped++;
        continue;
      }

      const downloadUrl = readDownloadUrl(file);
      if (!downloadUrl) {
        console.warn('⚠️ Activity file missing callbackURL / fileUrl');
        skipped++;
        continue;
      }

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

      const candidateActivityId = readCandidateActivityId(file);
      if (
        candidateActivityId &&
        (await activityFileExists(candidateActivityId, fileType))
      ) {
        console.log(
          `⏭️ FIT file for activity ${candidateActivityId} already processed`
        );
        skipped++;
        continue;
      }

      const bytes = await downloadGarminFitFile(athlete.id, downloadUrl);
      const parsed = parseFitActivityLaps(bytes);

      if (parsed.laps.length === 0) {
        console.warn('⚠️ FIT file contained no lap messages');
        skipped++;
        continue;
      }

      if (parsed.decodeErrors.length > 0) {
        console.warn('⚠️ FIT decode warnings:', parsed.decodeErrors.slice(0, 3));
      }

      const activityRow = await findActivityRowForFit({
        athleteId: athlete.id,
        sourceActivityId: candidateActivityId,
        sessionStartTimeInSeconds: parsed.sessionStartTimeInSeconds,
      });

      if (!activityRow) {
        console.warn(
          `⚠️ No athlete_activities row for FIT (candidate=${candidateActivityId ?? 'none'}, sessionStart=${parsed.sessionStartTimeInSeconds ?? 'none'})`
        );
        skipped++;
        continue;
      }

      const lapStartTimes = parsed.laps.map((lap) => lap.startTimeInSeconds);
      if (
        await activityFileAlreadyProcessed(
          activityRow.id,
          fileType,
          lapStartTimes
        )
      ) {
        console.log(
          `⏭️ FIT laps unchanged for activity ${activityRow.sourceActivityId}`
        );
        skipped++;
        continue;
      }

      const fitLapData: FitLapDataPayload = {
        fileType: 'FIT',
        processedAt: new Date().toISOString(),
        sourceActivityId: activityRow.sourceActivityId,
        sessionStartTimeInSeconds: parsed.sessionStartTimeInSeconds,
        laps: parsed.laps,
      };

      await prisma.athlete_activities.update({
        where: { id: activityRow.id },
        data: { fitLapData },
      });

      processed++;
      console.log(
        `✅ FIT laps persisted for activity ${activityRow.sourceActivityId} (${parsed.laps.length} laps)`
      );
    } catch (error: unknown) {
      errors++;
      console.error('❌ Error processing activity file:', error);
    }
  }

  return { processed, skipped, errors };
}
