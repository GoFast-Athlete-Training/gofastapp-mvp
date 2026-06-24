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
  activityMatchCandidateUtcRange,
  activityNameContainsPushedWorkoutTitle,
} from "@/lib/training/garmin-activity-match-helpers";
import {
  isHighConfidenceActivityCandidate,
  scoreActivityCandidateForWorkout,
  type ScoredActivityCandidate,
} from "@/lib/training/workout-activity-match-candidates";
import {
  applyActivityToWorkout,
  reassignActivityToWorkout,
} from "./apply-activity-to-workout";

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

type WorkoutMatchRow = Awaited<
  ReturnType<typeof prisma.workouts.findFirst<{ include: typeof workoutMatchInclude }>>
> &
  object;

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

function workoutScoreInput(workout: WorkoutMatchRow) {
  return {
    id: workout.id,
    title: workout.title,
    weekNumber: workout.weekNumber,
    date: workout.date,
    estimatedDistanceInMeters: workout.estimatedDistanceInMeters,
    workoutType: workout.workoutType,
    dayAssigned: workout.dayAssigned,
    planId: workout.planId,
  };
}

/** Pick a single planned workout from scored nearby candidates. */
export function selectPlannedWorkoutCandidate(params: {
  planCandidates: WorkoutMatchRow[];
  activity: {
    id: string;
    activityName: string | null;
    activityType: string | null;
    startTime: Date;
    duration: number | null;
    distance: number | null;
    averageSpeed: number | null;
    ingestionStatus: string;
    summaryData: unknown;
  };
  athleteActivityId?: string;
}): {
  candidate: WorkoutMatchRow | null;
  scored: ScoredActivityCandidate | null;
  titleMatchCount: number;
} {
  const activityInput = activityCandidateInput(params.activity);

  const scoredRows = params.planCandidates
    .map((workout) => ({
      workout,
      scored: scoreActivityCandidateForWorkout({
        workout: workoutScoreInput(workout),
        activity: activityInput,
      }),
    }))
    .filter(
      (
        row
      ): row is { workout: WorkoutMatchRow; scored: ScoredActivityCandidate } =>
        row.scored != null
    );

  const highConfidence = scoredRows.filter(({ scored }) =>
    isHighConfidenceActivityCandidate(scored)
  );

  if (highConfidence.length === 1) {
    const { workout, scored } = highConfidence[0]!;
    const titleMatchCount = scored.reasons.includes("title_match") ? 1 : 0;
    return { candidate: workout, scored, titleMatchCount };
  }

  if (highConfidence.length > 1) {
    const titleMatches = highConfidence.filter(({ scored }) =>
      scored.reasons.includes("title_match")
    );
    if (titleMatches.length === 1) {
      return {
        candidate: titleMatches[0]!.workout,
        scored: titleMatches[0]!.scored,
        titleMatchCount: 1,
      };
    }
    console.warn("⚠️ ambiguous high-confidence Garmin planned matches", {
      athleteActivityId: params.athleteActivityId,
      activityName: params.activity.activityName,
      candidateWorkoutIds: highConfidence.map(({ workout }) => workout.id),
    });
    return { candidate: null, scored: null, titleMatchCount: 0 };
  }

  const titleMatches = scoredRows.filter(({ scored }) =>
    scored.reasons.includes("title_match")
  );
  if (titleMatches.length === 1) {
    return {
      candidate: titleMatches[0]!.workout,
      scored: titleMatches[0]!.scored,
      titleMatchCount: 1,
    };
  }
  if (titleMatches.length > 1) {
    console.warn("⚠️ ambiguous Garmin title match; leaving activity unmatched", {
      athleteActivityId: params.athleteActivityId,
      activityName: params.activity.activityName,
      candidateWorkoutIds: titleMatches.map(({ workout }) => workout.id),
    });
  }

  return { candidate: null, scored: null, titleMatchCount: 0 };
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

  let candidate: WorkoutMatchRow | null = null;
  let precomputedScored: ScoredActivityCandidate | null = null;
  let precomputedTitleMatchCount = 0;

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
    const { start, end } = activityMatchCandidateUtcRange(activityYmd);
    const planCandidates = await prisma.workouts.findMany({
      where: {
        athleteId: activity.athleteId,
        planId: { not: null },
        matchedActivityId: null,
        date: { gte: start, lt: end },
      },
      include: workoutMatchInclude,
      orderBy: [{ garminWorkoutId: "desc" }, { updatedAt: "desc" }],
    });

    const selected = selectPlannedWorkoutCandidate({
      planCandidates,
      activity: {
        ...activity,
        startTime: activity.startTime,
      },
      athleteActivityId,
    });
    candidate = selected.candidate;
    precomputedScored = selected.scored;
    precomputedTitleMatchCount = selected.titleMatchCount;
  }

  if (!candidate) {
    await setIngestion("UNMATCHED");
    return { matched: false };
  }

  if (isPlannedWorkout(candidate)) {
    const titleMatchCount =
      precomputedTitleMatchCount > 0
        ? precomputedTitleMatchCount
        : activityNameContainsPushedWorkoutTitle({
            activityName: activity.activityName,
            workoutTitle: candidate.title,
            weekNumber: candidate.weekNumber,
            workoutType: candidate.workoutType,
            dayAssigned: candidate.dayAssigned,
            planId: candidate.planId,
          })
          ? 1
          : 0;

    const scored =
      precomputedScored ??
      scoreActivityCandidateForWorkout({
        workout: workoutScoreInput(candidate),
        activity: activityCandidateInput({
          ...activity,
          startTime: activity.startTime,
        }),
      });

    const autoMatchEligible =
      titleMatchCount === 1
        ? canAutoMatchPlannedWorkout({ scored, titleMatchCount })
        : scored != null && isHighConfidenceActivityCandidate(scored);

    if (autoMatchEligible && scored) {
      const existingLink = await prisma.workouts.findFirst({
        where: { matchedActivityId: activity.id },
        select: { id: true, planId: true },
      });

      if (existingLink && existingLink.id !== candidate.id) {
        if (existingLink.planId == null) {
          console.log("✅ reassigning activity from standalone ghost to planned workout", {
            athleteActivityId,
            ghostWorkoutId: existingLink.id,
            plannedWorkoutId: candidate.id,
            activityName: activity.activityName,
            workoutTitle: candidate.title,
          });
          const reassignResult = await reassignActivityToWorkout({
            activityId: activity.id,
            targetWorkoutId: candidate.id,
            athleteId: activity.athleteId,
          });
          if (reassignResult.success) {
            return { matched: true, workoutId: reassignResult.workoutId };
          }
        }

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
