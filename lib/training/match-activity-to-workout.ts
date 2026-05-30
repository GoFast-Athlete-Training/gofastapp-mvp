/**
 * Webhook ingest: store athlete_activity and optionally auto-link to standalone pushed workouts.
 * Planned workouts (planId set) are never auto-matched — athletes confirm via POST /match-activity.
 * Primary auto-match: garminWorkoutId ↔ workouts.garminWorkoutId on standalone rows only.
 */

import { prisma } from "@/lib/prisma";
import { extractGarminWorkoutIdFromSummary } from "./extract-garmin-workout-id";
import { RUNNING_ACTIVITY_TYPES } from "./activity-type-sets";
import {
  activityLocalYmdFromSummary,
  activityNameContainsPushedWorkoutTitle,
  utcDayRangeFromYmd,
} from "@/lib/training/garmin-activity-match-helpers";
import { applyActivityToWorkout } from "./apply-activity-to-workout";

export {
  computeMatchedWorkoutPaceCredits,
  computeMatchedWorkoutAerobicCeilingCredit,
  EASY_LONG_RUN_MAX_FAST_DRIFT_SEC_PER_MILE,
} from "./apply-activity-to-workout";

function isRunningActivityType(activityType: string | null | undefined): boolean {
  if (!activityType) return true;
  return RUNNING_ACTIVITY_TYPES.has(activityType.toUpperCase());
}

const workoutMatchInclude = {
  segments: { orderBy: { stepOrder: "asc" as const } },
  workout_catalogue: { select: { workBasePaceOffsetSecPerMile: true } },
};

function isPlannedWorkout(workout: { planId: string | null }): boolean {
  return workout.planId != null;
}

/** Webhook ingest must not mutate planned workouts — athletes confirm via POST /match-activity. */
export function isManualMatchOnlyWorkout(workout: { planId: string | null }): boolean {
  return isPlannedWorkout(workout);
}

/**
 * Match activity to at most one standalone workout; planned workouts stay manual-only.
 */
export async function tryMatchActivityToTrainingWorkout(
  athleteActivityId: string
): Promise<{ matched: boolean; workoutId?: string; candidateWorkoutId?: string }> {
  const activity = await prisma.athlete_activities.findUnique({
    where: { id: athleteActivityId },
  });

  if (!activity) {
    return { matched: false };
  }

  const setIngestion = async (status: string) => {
    await prisma.athlete_activities.update({
      where: { id: athleteActivityId },
      data: { ingestionStatus: status },
    });
  };

  if (!activity.startTime) {
    await setIngestion("UNMATCHED");
    return { matched: false };
  }

  if (!isRunningActivityType(activity.activityType)) {
    await setIngestion("INELIGIBLE");
    return { matched: false };
  }

  const summaryBlob = activity.summaryData as Record<string, unknown> | null;
  const garminWorkoutId = extractGarminWorkoutIdFromSummary(summaryBlob);

  let candidate = null;

  if (garminWorkoutId != null) {
    candidate = await prisma.workouts.findFirst({
      where: {
        athleteId: activity.athleteId,
        garminWorkoutId,
        matchedActivityId: null,
      },
      include: workoutMatchInclude,
    });
  }

  if (!candidate) {
    const activityYmd = activityLocalYmdFromSummary(activity.startTime, summaryBlob);
    const { start, end } = utcDayRangeFromYmd(activityYmd);
    const sameDayPlanCandidates = await prisma.workouts.findMany({
      where: {
        athleteId: activity.athleteId,
        planId: { not: null },
        matchedActivityId: null,
        date: { gte: start, lt: end },
      },
      include: workoutMatchInclude,
      orderBy: [{ garminWorkoutId: "desc" }, { updatedAt: "desc" }],
    });
    const titleMatches = sameDayPlanCandidates.filter((workout) =>
      activityNameContainsPushedWorkoutTitle({
        activityName: activity.activityName,
        workoutTitle: workout.title,
        weekNumber: workout.weekNumber,
      })
    );
    if (titleMatches.length === 1) {
      candidate = titleMatches[0];
      console.log("ℹ️ planned workout title candidate found; awaiting manual match", {
        athleteActivityId,
        workoutId: candidate.id,
        activityName: activity.activityName,
        workoutTitle: candidate.title,
        activityYmd,
      });
    } else if (titleMatches.length > 1) {
      console.warn("⚠️ ambiguous Garmin title match; leaving activity unmatched", {
        athleteActivityId,
        activityName: activity.activityName,
        activityYmd,
        candidateWorkoutIds: titleMatches.map((workout) => workout.id),
      });
    }
  }

  if (!candidate) {
    await setIngestion("UNMATCHED");
    return { matched: false };
  }

  if (isPlannedWorkout(candidate)) {
    console.log("ℹ️ planned workout candidate found; awaiting manual match", {
      athleteActivityId,
      workoutId: candidate.id,
      activityName: activity.activityName,
      workoutTitle: candidate.title,
    });
    await setIngestion("RECEIVED");
    return { matched: false, candidateWorkoutId: candidate.id };
  }

  const { workoutId } = await applyActivityToWorkout({
    workout: candidate,
    activity,
  });

  return { matched: true, workoutId };
}
