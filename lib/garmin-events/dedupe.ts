/**
 * Deduplication utilities for Garmin webhook events
 * Prevents double-saving activities and other data
 */

import { prisma } from '../prisma';

/**
 * Check if activity already exists by sourceActivityId (avoids duplicate webhook/sync saves).
 */
export async function activityExists(
  sourceActivityId: string
): Promise<boolean> {
  const existing = await prisma.athlete_activities.findUnique({
    where: { sourceActivityId },
    select: { id: true },
  });
  return !!existing;
}

/**
 * TODO: Activities will be reintroduced in Schema Phase 3
 * Check if activity file already exists
 */
export async function activityFileExists(
  activityId: string,
  fileType: string
): Promise<boolean> {
  // TODO: Re-enable when AthleteActivity model is reintroduced
  // Check if activity has this file type already processed
  // const activity = await prisma.athleteActivity.findUnique({
  //   where: { sourceActivityId: activityId },
  //   select: { detailData: true }
  // });
  
  // if (!activity?.detailData) {
  //   return false;
  // }
  
  // const detailData = activity.detailData as any;
  // const processedFiles = detailData.processedFiles || [];
  
  // return processedFiles.includes(fileType);
  return false;
}

/**
 * TODO: Activities will be reintroduced in Schema Phase 3
 * Mark activity file as processed
 */
export async function markActivityFileProcessed(
  activityId: string,
  fileType: string
): Promise<void> {
  // TODO: Re-enable when AthleteActivity model is reintroduced
  // const activity = await prisma.athleteActivity.findUnique({
  //   where: { sourceActivityId: activityId }
  // });
  
  // if (!activity) {
  //   return;
  // }
  
  // const detailData = (activity.detailData || {}) as any;
  // const processedFiles = detailData.processedFiles || [];
  
  // if (!processedFiles.includes(fileType)) {
  //   processedFiles.push(fileType);
    
  //   await prisma.athleteActivity.update({
  //     where: { sourceActivityId: activityId },
  //     data: {
  //       detailData: {
  //         ...detailData,
  //         processedFiles
  //       }
  //     }
  //   });
  // }
}

