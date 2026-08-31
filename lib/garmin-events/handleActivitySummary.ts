/**
 * Handle ACTIVITY_SUMMARY webhook events
 * Processes activity summary data from Garmin and stores in athlete_activities.
 */

import { prisma } from '../prisma';
import { getAthleteByGarminUserId } from '../domain-garmin';
import { activityExists } from './dedupe';
import { normalizeActivityFields } from './normalizeActivityFields';
import { tryMatchActivityToTrainingWorkout } from '../training/match-activity-to-workout';
import { tryMatchActivityToCityRun } from '../cta-triggers/try-match-activity-to-city-run';
import { promoteUnmatchedRunningActivityToWorkout } from '../training/promote-activity-to-workout';
import { tryMatchActivityToBikeWorkout } from '../training/match-activity-to-bike-workout';
import { isCyclingActivityType } from '../training/activity-type-sets';
import { sendAppNotification } from '../app-notifications/send';
import { isGenericGarminActivityName } from './generic-activity-names';

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

async function sendActivitySyncedCongratsIfNeeded(params: {
  activityId: string;
  athleteId: string;
  matchedWorkoutId?: string;
}): Promise<void> {
  if (params.matchedWorkoutId) {
    const workout = await prisma.workouts.findUnique({
      where: { id: params.matchedWorkoutId },
      select: { planId: true },
    });
    if (workout?.planId != null) {
      return;
    }
  }

  try {
    await sendAppNotification({
      athleteId: params.athleteId,
      templateKey: 'activity.synced',
      objectType: 'athlete_activity',
      objectId: params.activityId,
      deeplink: `/activities/${params.activityId}`,
      payload: {
        activityId: params.activityId,
        type: 'activity_synced',
        screen: 'activity',
        objectType: 'athlete_activity',
        objectId: params.activityId,
      },
    });
  } catch (err) {
    console.error('activity_synced push:', err);
  }
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

      if (isGenericGarminActivityName(activity.activityName)) {
        console.warn('⚠️ Skipped generic Garmin sample activity', {
          sourceActivityId,
          activityName: activity.activityName,
        });
        skipped++;
        continue;
      }

      const now = new Date();
      const norm = normalizeActivityFields(activity);
      const startTime = norm.startTime != null && !Number.isNaN(norm.startTime.getTime())
        ? norm.startTime
        : undefined;

      const created = await prisma.athlete_activities.create({
        data: {
          id: generateId(),
          athleteId: athlete.id,
          sourceActivityId,
          source: 'garmin',
          ingestionStatus: 'RECEIVED',
          activityType: activity.activityType ?? undefined,
          activityName: activity.activityName ?? undefined,
          startTime,
          duration: norm.duration,
          distance: norm.distance,
          calories: norm.calories,
          averageSpeed: norm.averageSpeed,
          averageHeartRate: norm.averageHeartRate,
          maxHeartRate: norm.maxHeartRate,
          elevationGain: norm.elevationGain,
          averagePower: norm.averagePower,
          steps: norm.steps,
          summaryData: activity as object,
          updatedAt: now,
        },
      });

      console.log('✅ athlete_activity created', {
        id: created.id,
        sourceActivityId,
        athleteId: athlete.id,
        activityType: activity.activityType,
        startTime: created.startTime?.toISOString() ?? null,
        ingestionStatus: 'RECEIVED',
      });

      try {
        let matchResult: { matched: boolean; workoutId?: string } = { matched: false };

        if (isCyclingActivityType(activity.activityType)) {
          await tryMatchActivityToBikeWorkout(created.id);
        } else {
          matchResult = await tryMatchActivityToTrainingWorkout(created.id);

          const ingestRow = await prisma.athlete_activities.findUnique({
            where: { id: created.id },
            select: { ingestionStatus: true },
          });
          if (!matchResult.matched && ingestRow?.ingestionStatus === 'UNMATCHED') {
            const promoteResult = await promoteUnmatchedRunningActivityToWorkout(created.id);
            if (promoteResult.promoted && promoteResult.workoutId) {
              matchResult = { matched: true, workoutId: promoteResult.workoutId };
            }
          }
        }
        await tryMatchActivityToCityRun(created.id).catch((cityRunErr) => {
          console.warn('tryMatchActivityToCityRun:', cityRunErr);
        });

        if (!isCyclingActivityType(activity.activityType)) {
          await sendActivitySyncedCongratsIfNeeded({
            activityId: created.id,
            athleteId: athlete.id,
            matchedWorkoutId: matchResult.workoutId,
          });
        }

        console.log("✅ match attempt complete", {
          id: created.id,
          sourceActivityId,
        });
      } catch (matchErr) {
        console.warn('tryMatchActivityToTrainingWorkout / BikeWorkout:', matchErr);
      }

      processed++;

    } catch (error: any) {
      errors++;
      console.error(`❌ Error processing activity summary ${activity.activityId}:`, error);
    }
  }

  return { processed, skipped, errors };
}

