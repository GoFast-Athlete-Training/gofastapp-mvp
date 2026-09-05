import { TrainingPlanLifecycle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  activityLocalYmdFromSummary,
  activityMatchCandidateUtcRange,
} from "@/lib/training/garmin-activity-match-helpers";
import {
  isHighConfidenceActivityCandidate,
  scoreActivityCandidateForWorkout,
  type ScoredActivityCandidate,
} from "@/lib/training/workout-activity-match-candidates";

/** True when a nearby unmatched planned workout could still claim this activity. */
export function isPlausiblePlannedWorkoutNearby(params: {
  scored: Pick<ScoredActivityCandidate, "reasons">;
}): boolean {
  if (params.scored.reasons.includes("title_match")) return true;
  if (isHighConfidenceActivityCandidate(params.scored)) return true;
  if (params.scored.reasons.includes("same_day")) return true;
  return false;
}

/** True when ingest should defer standalone ghost seeding — a plan row may still claim this run. */
export async function activityHasPlausiblePlannedWorkoutNearby(
  activityId: string
): Promise<boolean> {
  const activity = await prisma.athlete_activities.findUnique({
    where: { id: activityId },
    select: {
      id: true,
      athleteId: true,
      activityName: true,
      activityType: true,
      startTime: true,
      duration: true,
      distance: true,
      averageSpeed: true,
      ingestionStatus: true,
      summaryData: true,
    },
  });
  if (!activity?.startTime) return false;

  const summary = activity.summaryData as Record<string, unknown> | null;
  const activityYmd = activityLocalYmdFromSummary(activity.startTime, summary);
  const { start, end } = activityMatchCandidateUtcRange(activityYmd);

  const planCandidates = await prisma.planned_workouts.findMany({
    where: {
      athleteId: activity.athleteId,
      date: { gte: start, lt: end },
      workoutCompleted: false,
      OR: [
        { planId: null },
        { training_plans: { lifecycleStatus: TrainingPlanLifecycle.ACTIVE } },
      ],
    },
    select: {
      id: true,
      title: true,
      weekNumber: true,
      date: true,
      estimatedDistanceInMeters: true,
      workoutType: true,
      dayAssigned: true,
      planId: true,
      workout_catalogue: { select: { name: true } },
    },
  });

  const activityInput = {
    id: activity.id,
    activityName: activity.activityName,
    activityType: activity.activityType,
    startTime: activity.startTime,
    duration: activity.duration,
    distance: activity.distance,
    averageSpeed: activity.averageSpeed,
    ingestionStatus: activity.ingestionStatus,
    summaryData: activity.summaryData,
    matchedWorkoutId: null,
    matchedWorkoutTitle: null,
  };

  for (const planned of planCandidates) {
    const scored = scoreActivityCandidateForWorkout({
      workout: {
        id: planned.id,
        title: planned.title,
        weekNumber: planned.weekNumber,
        date: planned.date,
        estimatedDistanceInMeters: planned.estimatedDistanceInMeters,
        workoutType: planned.workoutType,
        dayAssigned: planned.dayAssigned,
        planId: planned.planId,
        catalogueName: planned.workout_catalogue?.name ?? null,
      },
      activity: activityInput,
    });
    if (scored && isPlausiblePlannedWorkoutNearby({ scored })) {
      return true;
    }
  }

  return false;
}
