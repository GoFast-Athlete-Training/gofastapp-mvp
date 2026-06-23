/**
 * Webhook ingest: store athlete_activity and optionally auto-link to workouts.
 * Standalone pushed workouts: auto-match via garminWorkoutId.
 * Planned workouts: auto-match only when a single high-confidence candidate is found
 * (title match or same-day close distance); otherwise athletes confirm via POST /match-activity.
 */

import { prisma } from "@/lib/prisma";
import { extractGarminWorkoutIdFromSummary } from "./extract-garmin-workout-id";
import { RUNNING_ACTIVITY_TYPES } from "./activity-type-sets";
import {
  activityLocalYmdFromSummary,
  activityNameContainsPushedWorkoutTitle,
  utcDayRangeFromYmd,
} from "@/lib/training/garmin-activity-match-helpers";
import {
  isHighConfidenceActivityCandidate,
  scoreActivityCandidateForWorkout,
  type ScoredActivityCandidate,
} from "@/lib/training/workout-activity-match-candidates";
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

/** Planned workouts support manual match; ingest may still auto-link high-confidence candidates. */
export function isManualMatchOnlyWorkout(workout: { planId: string | null }): boolean {
  return isPlannedWorkout(workout);
}

/** True when a single planned-workout candidate is safe to auto-link on ingest. */
export function canAutoMatchPlannedWorkout(params: {
  scored: Pick<ScoredActivityCandidate, "reasons"> | null;
  titleMatchCount: number;
}): boolean {
  if (params.titleMatchCount !== 1) return false;
  if (!params.scored) return false;
  return isHighConfidenceActivityCandidate(params.scored);
}

function activityCandidateInput(activity: {
  id: string;
  activityName: string | null;
  activityType: string | null;
  startTime: Date;
  duration: number | null;
  distance: number | null;
  averageSpeed: number | null;
  ingestionStatus: string;
  summaryData: unknown;
}) {
  return {
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
}

/**
 * Match activity to at most one workout; planned workouts auto-link only when high-confidence.
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
    const titleMatchCount = activityNameContainsPushedWorkoutTitle({
      activityName: activity.activityName,
      workoutTitle: candidate.title,
      weekNumber: candidate.weekNumber,
    })
      ? 1
      : 0;

    const scored = scoreActivityCandidateForWorkout({
      workout: {
        id: candidate.id,
        title: candidate.title,
        weekNumber: candidate.weekNumber,
        date: candidate.date,
        estimatedDistanceInMeters: candidate.estimatedDistanceInMeters,
      },
      activity: activityCandidateInput({
        ...activity,
        startTime: activity.startTime!,
      }),
    });

    const autoMatchEligible =
      titleMatchCount === 1
        ? canAutoMatchPlannedWorkout({ scored, titleMatchCount })
        : scored != null && isHighConfidenceActivityCandidate(scored);

    if (autoMatchEligible && scored) {
      const existingLink = await prisma.workouts.findFirst({
        where: { matchedActivityId: activity.id },
        select: { id: true },
      });
      if (existingLink && existingLink.id !== candidate.id) {
        console.warn("⚠️ activity already linked to another workout; skipping auto-match", {
          athleteActivityId,
          existingWorkoutId: existingLink.id,
          candidateWorkoutId: candidate.id,
        });
        await setIngestion("RECEIVED");
        return { matched: false, candidateWorkoutId: candidate.id };
      }

      console.log("✅ auto-matching high-confidence planned workout", {
        athleteActivityId,
        workoutId: candidate.id,
        activityName: activity.activityName,
        workoutTitle: candidate.title,
        reasonLabels: scored.reasonLabels,
      });
      const { workoutId } = await applyActivityToWorkout({
        workout: candidate,
        activity,
      });
      return { matched: true, workoutId };
    }

    console.log("ℹ️ planned workout candidate found; awaiting manual match", {
      athleteActivityId,
      workoutId: candidate.id,
      activityName: activity.activityName,
      workoutTitle: candidate.title,
      reasonLabels: scored?.reasonLabels ?? [],
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
