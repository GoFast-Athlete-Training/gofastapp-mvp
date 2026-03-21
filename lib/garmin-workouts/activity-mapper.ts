/**
 * @deprecated Orphaned — references training_days_executed (trainingmvp). Not imported by gofastapp-mvp API routes.
 * Activity ↔ workout promotion lives in lib/training/match-activity-to-workout.ts + workouts.garminWorkoutId.
 *
 * Activity Mapper Service
 * Maps Garmin activityId back to our training_days_executed
 * 
 * We have TWO Garmin activity feeds:
 * 1. ACTIVITY_SUMMARY webhook - summary data (handleActivitySummary)
 * 2. ACTIVITY_DETAIL webhook - detailed data (handleActivityDetail)
 * 3. Manual sync API - Wellness API REST endpoint
 * 
 * All activities are stored in athlete_activities with:
 * - id: our internal ID
 * - sourceActivityId: Garmin's activity ID (unique, from activity.activityId)
 * - source: "garmin"
 */

import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";

/**
 * Link a Garmin activity to a training day
 * 
 * When we get an activity back from Garmin (via webhook or sync):
 * 1. Activity is saved to athlete_activities with sourceActivityId = Garmin's activityId
 * 2. We need to find which training day this activity fulfills
 * 3. Link via training_days_executed.activityId = athlete_activities.id
 * 
 * @param athleteActivityId - Our athlete_activities.id
 * @param trainingDayId - training_days_executed.id
 * @param garminActivityId - Garmin's activity ID (from sourceActivityId)
 */
export async function linkActivityToTrainingDay(
  athleteActivityId: string, // Our athlete_activities.id
  trainingDayId: string, // training_days_executed.id
  garminActivityId?: string // Garmin's activity ID (from sourceActivityId)
): Promise<void> {
  const existing = await prisma.training_days_executed.findUnique({
    where: { id: trainingDayId },
    select: { plannedData: true },
  });

  await prisma.training_days_executed.update({
    where: { id: trainingDayId },
    data: {
      activityId: athleteActivityId, // Link to our athlete_activities.id
      plannedData: {
        // Preserve existing plannedData, add Garmin tracking
        ...(existing?.plannedData as Record<string, any> || {}),
        garminActivityId: garminActivityId || (existing?.plannedData as any)?.garminActivityId,
      },
    },
  });
}

/**
 * Find training day by Garmin workout ID
 * 
 * When an activity comes back from Garmin, we can look up which workout it was from
 * by checking plannedData.garminWorkoutId
 */
export async function findTrainingDayByGarminWorkoutId(
  garminWorkoutId: number,
  athleteId: string
): Promise<{ id: string; plannedData: any; date: Date } | null> {
  const days = await prisma.training_days_executed.findMany({
    where: {
      athleteId,
      plannedData: {
        path: ["garminWorkoutId"],
        equals: garminWorkoutId,
      },
    },
    select: {
      id: true,
      plannedData: true,
      date: true,
    },
    orderBy: {
      date: "desc", // Most recent first
    },
  });

  return days[0] || null;
}

/**
 * Find training day by Garmin activity ID (sourceActivityId)
 * 
 * When we receive an activity from Garmin webhook/sync:
 * 1. Activity has activityId (Garmin's ID)
 * 2. We save it to athlete_activities with sourceActivityId = activityId
 * 3. We can match it to a training day by date/time proximity
 */
export async function findTrainingDayByGarminActivityId(
  garminActivityId: string | number,
  athleteId: string,
  activityStartTime?: Date
): Promise<{ id: string; plannedData: any; date: Date } | null> {
  // First, try to find by exact match in plannedData
  const daysWithGarminId = await prisma.training_days_executed.findMany({
    where: {
      athleteId,
      plannedData: {
        path: ["garminActivityId"],
        equals: garminActivityId.toString(),
      },
    },
    select: {
      id: true,
      plannedData: true,
      date: true,
    },
  });

  if (daysWithGarminId.length > 0) {
    return daysWithGarminId[0];
  }

  // If no exact match, try to match by date (if activityStartTime provided)
  if (activityStartTime) {
    const activityDate = new Date(activityStartTime);
    activityDate.setHours(0, 0, 0, 0); // Start of day

    const daysByDate = await prisma.training_days_executed.findMany({
      where: {
        athleteId,
        date: {
          gte: activityDate,
          lt: new Date(activityDate.getTime() + 24 * 60 * 60 * 1000), // Next day
        },
        activityId: null, // Not already linked
      },
      select: {
        id: true,
        plannedData: true,
        date: true,
      },
      orderBy: {
        date: "desc",
      },
    });

    // Return the closest match (or first if multiple)
    return daysByDate[0] || null;
  }

  return null;
}

/**
 * Auto-link activity to training day
 * 
 * When we receive an activity from Garmin (webhook or sync):
 * 1. Activity is saved to athlete_activities
 * 2. This function tries to automatically link it to a training day
 * 
 * Matching strategy:
 * - If plannedData.garminWorkoutId exists, try to match by workout
 * - Otherwise, match by date proximity
 */
export async function autoLinkActivityToTrainingDay(
  athleteActivityId: string, // Our athlete_activities.id
  garminActivityId: string | number, // Garmin's activity ID
  athleteId: string,
  activityStartTime?: Date
): Promise<{ linked: boolean; trainingDayId?: string }> {
  // Get the activity to check if it has workout info
  const activity = await prisma.athlete_activities.findUnique({
    where: { id: athleteActivityId },
    select: {
      startTime: true,
      summaryData: true,
    },
  });

  const startTime = activityStartTime || activity?.startTime || undefined;

  // Try to find training day
  const trainingDay = await findTrainingDayByGarminActivityId(
    garminActivityId,
    athleteId,
    startTime
  );

  if (trainingDay) {
    await linkActivityToTrainingDay(athleteActivityId, trainingDay.id, garminActivityId.toString());
    return { linked: true, trainingDayId: trainingDay.id };
  }

  return { linked: false };
}

/**
 * Get all training days that have been synced to Garmin
 */
export async function getSyncedTrainingDays(athleteId: string) {
  return prisma.training_days_executed.findMany({
    where: {
      athleteId,
      plannedData: {
        path: ["garminSyncedAt"],
        not: Prisma.JsonNull,
      },
    },
  });
}

/**
 * Get activity by Garmin activity ID (sourceActivityId)
 */
export async function getActivityByGarminId(
  garminActivityId: string | number,
  athleteId: string
) {
  return prisma.athlete_activities.findFirst({
    where: {
      athleteId,
      sourceActivityId: garminActivityId.toString(),
      source: "garmin",
    },
  });
}
