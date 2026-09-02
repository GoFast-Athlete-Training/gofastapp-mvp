/**
 * Webhook ingest: store athlete_activity and optionally auto-link to workouts.
 * Standalone pushed workouts: auto-match via garminWorkoutId.
 * Planned workouts: auto-match only when a single high-confidence title match is found;
 * otherwise athletes confirm via POST /match-activity.
 */

import { TrainingPlanLifecycle } from "@prisma/client";
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
} from "./apply-activity-to-workout";
import {
  applyActivityToPlannedWorkout,
  plannedDayConsumedByOtherActivity,
  reassignActivityToPlannedWorkout,
} from "./match-planned-workout";

export {
  computeMatchedWorkoutPaceCredits,
  computeMatchedWorkoutAerobicCeilingCredit,
  EASY_LONG_RUN_MAX_FAST_DRIFT_SEC_PER_MILE,
} from "./apply-activity-to-workout";

function isRunningActivityType(activityType: string | null | undefined): boolean {
  if (!activityType) return true;
  return RUNNING_ACTIVITY_TYPES.has(activityType.toUpperCase());
}

const plannedMatchInclude = {
  segments: { orderBy: { stepOrder: "asc" as const } },
  workout_catalogue: { select: { workBasePaceOffsetSecPerMile: true, name: true } },
};

type PlannedMatchRow = Awaited<
  ReturnType<
    typeof prisma.planned_workouts.findFirst<{ include: typeof plannedMatchInclude }>
  >
> &
  object;

const workoutMatchInclude = {
  segments: { orderBy: { stepOrder: "asc" as const } },
  workout_catalogue: { select: { workBasePaceOffsetSecPerMile: true, name: true } },
};

type WorkoutMatchRow = Awaited<
  ReturnType<typeof prisma.workouts.findFirst<{ include: typeof workoutMatchInclude }>>
> &
  object;

/** Planned workouts support manual match; ingest may still auto-link high-confidence candidates. */
export function isManualMatchOnlyWorkout(workout: { planId: string | null }): boolean {
  return workout.planId != null;
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

function plannedScoreInput(planned: PlannedMatchRow) {
  return {
    id: planned.id,
    title: planned.title,
    weekNumber: planned.weekNumber,
    date: planned.date,
    estimatedDistanceInMeters: planned.estimatedDistanceInMeters,
    workoutType: planned.workoutType,
    dayAssigned: planned.dayAssigned,
    planId: planned.planId,
    catalogueName: planned.workout_catalogue?.name ?? null,
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
    catalogueName: workout.workout_catalogue?.name ?? null,
  };
}

function logGarminWorkoutMatchAttempt(payload: {
  activityId: string;
  plannedWorkoutId: string | null;
  rawGarminWorkoutName: string | null;
  rawPlannedWorkoutName: string | null;
  catalogueName?: string | null;
  garminNameProperty: string;
  titleMatch: boolean;
  matchCandidateFound: boolean;
  relationshipPersisted: boolean;
  plannedWorkoutMarkedCompleted: boolean;
  error?: string;
}) {
  console.log("GARMIN WORKOUT MATCH ATTEMPT", payload);
}

/** Pick a single planned workout from scored nearby candidates. */
export function selectPlannedWorkoutCandidate(params: {
  planCandidates: PlannedMatchRow[];
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
  candidate: PlannedMatchRow | null;
  scored: ScoredActivityCandidate | null;
  titleMatchCount: number;
} {
  const activityInput = activityCandidateInput(params.activity);

  const scoredRows = params.planCandidates
    .map((planned) => ({
      planned,
      scored: scoreActivityCandidateForWorkout({
        workout: plannedScoreInput(planned),
        activity: activityInput,
      }),
    }))
    .filter(
      (
        row
      ): row is { planned: PlannedMatchRow; scored: ScoredActivityCandidate } =>
        row.scored != null
    );

  const highConfidence = scoredRows.filter(({ scored }) =>
    isHighConfidenceActivityCandidate(scored)
  );

  if (highConfidence.length === 1) {
    const { planned, scored } = highConfidence[0]!;
    const titleMatchCount = scored.reasons.includes("title_match") ? 1 : 0;
    return { candidate: planned, scored, titleMatchCount };
  }

  if (highConfidence.length > 1) {
    const titleMatches = highConfidence.filter(({ scored }) =>
      scored.reasons.includes("title_match")
    );
    if (titleMatches.length === 1) {
      return {
        candidate: titleMatches[0]!.planned,
        scored: titleMatches[0]!.scored,
        titleMatchCount: 1,
      };
    }
    console.warn("⚠️ ambiguous high-confidence Garmin planned matches", {
      athleteActivityId: params.athleteActivityId,
      activityName: params.activity.activityName,
      candidatePlannedWorkoutIds: highConfidence.map(({ planned }) => planned.id),
    });
    return { candidate: null, scored: null, titleMatchCount: 0 };
  }

  const titleMatches = scoredRows.filter(({ scored }) =>
    scored.reasons.includes("title_match")
  );
  if (titleMatches.length === 1) {
    return {
      candidate: titleMatches[0]!.planned,
      scored: titleMatches[0]!.scored,
      titleMatchCount: 1,
    };
  }
  if (titleMatches.length > 1) {
    console.warn("⚠️ ambiguous Garmin title match; leaving activity unmatched", {
      athleteActivityId: params.athleteActivityId,
      activityName: params.activity.activityName,
      candidatePlannedWorkoutIds: titleMatches.map(({ planned }) => planned.id),
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

  const alreadyLinked = await prisma.workouts.findFirst({
    where: { garminDetailActivityId: athleteActivityId },
    select: { id: true, title: true },
  });
  if (alreadyLinked) {
    if (activity.ingestionStatus !== "MATCHED") {
      await setIngestion("MATCHED");
    }
    logGarminWorkoutMatchAttempt({
      activityId: athleteActivityId,
      plannedWorkoutId: alreadyLinked.id,
      rawGarminWorkoutName: activity.activityName,
      rawPlannedWorkoutName: alreadyLinked.title,
      garminNameProperty: "athlete_activities.activityName",
      titleMatch: true,
      matchCandidateFound: true,
      relationshipPersisted: true,
      plannedWorkoutMarkedCompleted: true,
    });
    return { matched: true, workoutId: alreadyLinked.id };
  }

  const summaryBlob = activity.summaryData as Record<string, unknown> | null;
  const garminWorkoutId = extractGarminWorkoutIdFromSummary(summaryBlob);

  let plannedCandidate: PlannedMatchRow | null = null;
  let standaloneCandidate: WorkoutMatchRow | null = null;
  let precomputedScored: ScoredActivityCandidate | null = null;
  let precomputedTitleMatchCount = 0;

  if (garminWorkoutId != null) {
    plannedCandidate = await prisma.planned_workouts.findFirst({
      where: {
        athleteId: activity.athleteId,
        garminWorkoutId,
        OR: [
          { planId: null },
          { training_plans: { lifecycleStatus: TrainingPlanLifecycle.ACTIVE } },
        ],
      },
      include: plannedMatchInclude,
    });

    if (!plannedCandidate) {
      standaloneCandidate = await prisma.workouts.findFirst({
        where: {
          athleteId: activity.athleteId,
          garminWorkoutId,
          garminDetailActivityId: null,
          planId: null,
        },
        include: workoutMatchInclude,
      });
    }
  }

  if (!plannedCandidate && !standaloneCandidate) {
    const activityYmd = activityLocalYmdFromSummary(activity.startTime, summaryBlob);
    const { start, end } = activityMatchCandidateUtcRange(activityYmd);
    const planCandidates = await prisma.planned_workouts.findMany({
      where: {
        athleteId: activity.athleteId,
        date: { gte: start, lt: end },
        OR: [
          { planId: null },
          { training_plans: { lifecycleStatus: TrainingPlanLifecycle.ACTIVE } },
        ],
      },
      include: plannedMatchInclude,
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
    plannedCandidate = selected.candidate;
    precomputedScored = selected.scored;
    precomputedTitleMatchCount = selected.titleMatchCount;
  }

  if (!plannedCandidate && !standaloneCandidate) {
    logGarminWorkoutMatchAttempt({
      activityId: athleteActivityId,
      plannedWorkoutId: null,
      rawGarminWorkoutName: activity.activityName,
      rawPlannedWorkoutName: null,
      garminNameProperty: "athlete_activities.activityName",
      titleMatch: false,
      matchCandidateFound: false,
      relationshipPersisted: false,
      plannedWorkoutMarkedCompleted: false,
    });
    await setIngestion("UNMATCHED");
    return { matched: false };
  }

  if (plannedCandidate) {
    if (
      await plannedDayConsumedByOtherActivity({
        plannedWorkoutId: plannedCandidate.id,
        activityId: activity.id,
      })
    ) {
      console.warn("⚠️ planned day already matched to another activity", {
        athleteActivityId,
        plannedWorkoutId: plannedCandidate.id,
      });
      await setIngestion("RECEIVED");
      return { matched: false, candidateWorkoutId: plannedCandidate.id };
    }

    const titleMatchCount =
      precomputedTitleMatchCount > 0
        ? precomputedTitleMatchCount
        : activityNameContainsPushedWorkoutTitle({
            activityName: activity.activityName,
            workoutTitle: plannedCandidate.title,
            weekNumber: plannedCandidate.weekNumber,
            workoutType: plannedCandidate.workoutType,
            dayAssigned: plannedCandidate.dayAssigned,
            planId: plannedCandidate.planId,
            catalogueName: plannedCandidate.workout_catalogue?.name ?? null,
            estimatedDistanceInMeters: plannedCandidate.estimatedDistanceInMeters,
          })
          ? 1
          : 0;

    const scored =
      precomputedScored ??
      scoreActivityCandidateForWorkout({
        workout: plannedScoreInput(plannedCandidate),
        activity: activityCandidateInput({
          ...activity,
          startTime: activity.startTime,
        }),
      });

    const autoMatchEligible = canAutoMatchPlannedWorkout({ scored, titleMatchCount });

    if (autoMatchEligible && scored) {
      const existingLink = await prisma.workouts.findFirst({
        where: { garminDetailActivityId: activity.id },
        select: { id: true, planId: true, plannedWorkoutId: true },
      });

      if (
        existingLink &&
        existingLink.plannedWorkoutId !== plannedCandidate.id &&
        existingLink.id !== plannedCandidate.id
      ) {
        if (existingLink.planId == null && existingLink.plannedWorkoutId == null) {
          console.log("✅ reassigning activity from standalone ghost to planned workout", {
            athleteActivityId,
            ghostWorkoutId: existingLink.id,
            plannedWorkoutId: plannedCandidate.id,
            activityName: activity.activityName,
            workoutTitle: plannedCandidate.title,
          });
          const reassignResult = await reassignActivityToPlannedWorkout({
            activityId: activity.id,
            plannedWorkoutId: plannedCandidate.id,
            athleteId: activity.athleteId,
          });
          if (reassignResult.success) {
            return { matched: true, workoutId: reassignResult.workoutId };
          }
        }

        console.warn("⚠️ activity already linked to another workout; skipping auto-match", {
          athleteActivityId,
          existingWorkoutId: existingLink.id,
          candidatePlannedWorkoutId: plannedCandidate.id,
        });
        await setIngestion("RECEIVED");
        return { matched: false, candidateWorkoutId: plannedCandidate.id };
      }

      console.log("✅ auto-matching high-confidence planned workout", {
        athleteActivityId,
        plannedWorkoutId: plannedCandidate.id,
        activityName: activity.activityName,
        workoutTitle: plannedCandidate.title,
        reasonLabels: scored.reasonLabels,
      });
      try {
        const { workoutId } = await applyActivityToPlannedWorkout({
          plannedWorkoutId: plannedCandidate.id,
          activity,
        });
        logGarminWorkoutMatchAttempt({
          activityId: athleteActivityId,
          plannedWorkoutId: plannedCandidate.id,
          rawGarminWorkoutName: activity.activityName,
          rawPlannedWorkoutName: plannedCandidate.title,
          catalogueName: plannedCandidate.workout_catalogue?.name ?? null,
          garminNameProperty: "athlete_activities.activityName",
          titleMatch: titleMatchCount === 1,
          matchCandidateFound: true,
          relationshipPersisted: true,
          plannedWorkoutMarkedCompleted: true,
        });
        return { matched: true, workoutId };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logGarminWorkoutMatchAttempt({
          activityId: athleteActivityId,
          plannedWorkoutId: plannedCandidate.id,
          rawGarminWorkoutName: activity.activityName,
          rawPlannedWorkoutName: plannedCandidate.title,
          catalogueName: plannedCandidate.workout_catalogue?.name ?? null,
          garminNameProperty: "athlete_activities.activityName",
          titleMatch: titleMatchCount === 1,
          matchCandidateFound: true,
          relationshipPersisted: false,
          plannedWorkoutMarkedCompleted: false,
          error: message,
        });
        throw error;
      }
    }

    logGarminWorkoutMatchAttempt({
      activityId: athleteActivityId,
      plannedWorkoutId: plannedCandidate.id,
      rawGarminWorkoutName: activity.activityName,
      rawPlannedWorkoutName: plannedCandidate.title,
      catalogueName: plannedCandidate.workout_catalogue?.name ?? null,
      garminNameProperty: "athlete_activities.activityName",
      titleMatch: titleMatchCount === 1,
      matchCandidateFound: true,
      relationshipPersisted: false,
      plannedWorkoutMarkedCompleted: false,
      error: `awaiting_manual_match reasons=${(scored?.reasonLabels ?? []).join(",")}`,
    });
    console.log("ℹ️ planned workout candidate found; awaiting manual match", {
      athleteActivityId,
      plannedWorkoutId: plannedCandidate.id,
      activityName: activity.activityName,
      workoutTitle: plannedCandidate.title,
      reasonLabels: scored?.reasonLabels ?? [],
    });
    await setIngestion("RECEIVED");
    return { matched: false, candidateWorkoutId: plannedCandidate.id };
  }

  const { workoutId } = await applyActivityToWorkout({
    workout: standaloneCandidate!,
    activity,
  });

  return { matched: true, workoutId };
}
