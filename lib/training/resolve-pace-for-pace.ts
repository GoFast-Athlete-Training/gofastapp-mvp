/**
 * Explicit Splits resolve: match + lap parse + pace analyzer.
 */

import { prisma } from "@/lib/prisma";
import { parseActivityToSegmentExecution } from "./activity-to-segment-execution";
import { tryMatchActivityToTrainingWorkout } from "./match-activity-to-workout";
import {
  loadWorkoutForAnalysis,
  resolveWorkoutIdFromActivity,
  type LoadedWorkoutForAnalysis,
} from "./load-workout-analysis";
import {
  derivePaceForPaceStatus,
  type PaceForPaceStatus,
} from "./pace-for-pace-status";
import {
  scoreAndSortActivityCandidates,
  workoutMatchCandidateUtcRange,
} from "./workout-activity-match-candidates";
import { RUNNING_ACTIVITY_TYPES } from "./activity-type-sets";
import {
  analyzeWorkoutPaceDeltas,
  NO_DETAIL_SUPPORT_MESSAGE,
} from "./workout-pace-analyzer";

const LOG_PREFIX = "PACE_FOR_PACE";

export type PaceForPaceMatchCandidate = {
  activityId: string;
  activityName: string | null;
  startTime: string | null;
  distanceMeters: number | null;
  score: number;
};

export type ResolvePaceForPaceResult =
  | {
      ok: true;
      workoutId: string;
      activityId: string | null;
      paceForPaceStatus: PaceForPaceStatus;
      message: string | null;
      performanceAnalysis: LoadedWorkoutForAnalysis["performanceAnalysis"];
      workout: LoadedWorkoutForAnalysis["workout"];
    }
  | {
      ok: false;
      code:
        | "NOT_FOUND"
        | "UNMATCHED"
        | "AMBIGUOUS_MATCH"
        | "SEGMENT_PARSE_FAILED"
        | "NO_DETAIL";
      message: string;
      workoutId?: string;
      activityId?: string;
      matchCandidates?: PaceForPaceMatchCandidate[];
    };

function isRunningActivityType(activityType: string | null | undefined): boolean {
  if (!activityType) return true;
  return RUNNING_ACTIVITY_TYPES.has(activityType.toUpperCase());
}

async function loadMatchCandidatesForWorkout(params: {
  workoutId: string;
  athleteId: string;
}): Promise<PaceForPaceMatchCandidate[]> {
  const workout = await prisma.workouts.findFirst({
    where: { id: params.workoutId, athleteId: params.athleteId },
    select: { id: true, date: true, title: true },
  });
  if (!workout) return [];

  const range = workoutMatchCandidateUtcRange(workout.date);
  if (!range) return [];
  const { start, end } = range;
  const activities = await prisma.athlete_activities.findMany({
    where: {
      athleteId: params.athleteId,
      startTime: { gte: start, lt: end },
    },
    select: {
      id: true,
      activityName: true,
      activityType: true,
      startTime: true,
      distance: true,
      duration: true,
      averageSpeed: true,
      ingestionStatus: true,
      summaryData: true,
    },
    orderBy: { startTime: "desc" },
    take: 20,
  });

  const running = activities.filter((a) => isRunningActivityType(a.activityType));
  const scored = scoreAndSortActivityCandidates({
    workout: {
      id: workout.id,
      title: workout.title ?? "",
      weekNumber: null,
      date: workout.date,
      estimatedDistanceInMeters: null,
    },
    activities: running.map((a) => ({
      id: a.id,
      activityName: a.activityName,
      activityType: a.activityType,
      startTime: a.startTime,
      duration: a.duration,
      distance: a.distance,
      averageSpeed: a.averageSpeed,
      ingestionStatus: a.ingestionStatus,
      summaryData: a.summaryData,
      matchedWorkoutId: null,
      matchedWorkoutTitle: null,
    })),
  });

  return scored.map((c) => ({
    activityId: c.id,
    activityName: c.activityName,
    startTime: c.startTime?.toISOString() ?? null,
    distanceMeters: c.distance,
    score: c.score,
  }));
}

export async function resolvePaceForPace(params: {
  athleteId: string;
  workoutId?: string | null;
  activityId?: string | null;
}): Promise<ResolvePaceForPaceResult> {
  let workoutId = params.workoutId?.trim() || null;
  let activityId = params.activityId?.trim() || null;

  console.log(`${LOG_PREFIX} resolve start`, {
    athleteId: params.athleteId,
    workoutId,
    activityId,
  });

  if (!workoutId && activityId) {
    workoutId = await resolveWorkoutIdFromActivity({
      activityId,
      athleteId: params.athleteId,
    });
    console.log(`${LOG_PREFIX} resolved workout from activity`, { activityId, workoutId });
  }

  if (!workoutId && activityId) {
    console.log(`${LOG_PREFIX} attempting auto-match`, { activityId });
    const matchResult = await tryMatchActivityToTrainingWorkout(activityId);
    if (matchResult.matched && matchResult.workoutId) {
      workoutId = matchResult.workoutId;
    } else if (matchResult.candidateWorkoutId) {
      return {
        ok: false,
        code: "AMBIGUOUS_MATCH",
        message: "Multiple workouts could match this activity. Link the correct workout first.",
        activityId,
        workoutId: matchResult.candidateWorkoutId,
        matchCandidates: await loadMatchCandidatesForWorkout({
          workoutId: matchResult.candidateWorkoutId,
          athleteId: params.athleteId,
        }),
      };
    } else {
      return {
        ok: false,
        code: "UNMATCHED",
        message: "No planned workout matched this activity.",
        activityId,
      };
    }
  }

  if (!workoutId) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Provide workoutId or activityId.",
    };
  }

  let loaded = await loadWorkoutForAnalysis({
    workoutId,
    athleteId: params.athleteId,
  });

  if (!loaded) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Workout not found.",
      workoutId,
    };
  }

  activityId = loaded.workout.garminDetailActivityId ?? activityId;

  if (!activityId) {
    const candidates = await loadMatchCandidatesForWorkout({
      workoutId,
      athleteId: params.athleteId,
    });
    return {
      ok: false,
      code: "UNMATCHED",
      message: "No activity linked to this workout.",
      workoutId,
      matchCandidates: candidates.length > 0 ? candidates : undefined,
    };
  }

  const activity = await prisma.athlete_activities.findFirst({
    where: { id: activityId, athleteId: params.athleteId },
    select: { id: true, detailData: true, hydratedAt: true },
  });

  if (!activity) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Linked activity not found.",
      workoutId,
      activityId,
    };
  }

  const hasDetail =
    activity.detailData != null ||
    loaded.workout.completedActivityDetailJson != null;

  console.log(`${LOG_PREFIX} activity detail`, {
    activityId,
    hasDetail,
    hydratedAt: activity.hydratedAt,
  });

  if (activity.detailData && typeof activity.detailData === "object") {
    await prisma.workouts.update({
      where: { id: workoutId },
      data: { completedActivityDetailJson: activity.detailData as object },
    });
  }

  if (!hasDetail) {
    return {
      ok: false,
      code: "NO_DETAIL",
      message: NO_DETAIL_SUPPORT_MESSAGE,
      workoutId,
      activityId,
    };
  }

  const parseResult = await parseActivityToSegmentExecution({
    activityId,
    workoutId,
  });

  console.log(`${LOG_PREFIX} segment parse`, {
    workoutId,
    activityId,
    result: parseResult,
  });

  if (!parseResult.ok && parseResult.status !== "NO_LAPS") {
    return {
      ok: false,
      code: "SEGMENT_PARSE_FAILED",
      message: parseResult.message,
      workoutId,
      activityId,
    };
  }

  const analyzeResult = await analyzeWorkoutPaceDeltas({ workoutId, activityId });
  console.log(`${LOG_PREFIX} pace analyzer`, { workoutId, activityId, analyzeResult });

  if (!analyzeResult.ok) {
    return {
      ok: false,
      code: "SEGMENT_PARSE_FAILED",
      message: analyzeResult.message,
      workoutId,
      activityId,
    };
  }

  if (analyzeResult.deltasWritten === 0) {
    return {
      ok: false,
      code: "SEGMENT_PARSE_FAILED",
      message: "Could not compute pace deltas for these laps.",
      workoutId,
      activityId,
    };
  }

  loaded = await loadWorkoutForAnalysis({
    workoutId,
    athleteId: params.athleteId,
  });

  if (!loaded) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Workout not found after analysis.",
      workoutId,
    };
  }

  const statusResult = derivePaceForPaceStatus(
    loaded.analysisInput,
    loaded.performanceAnalysis
  );

  console.log(`${LOG_PREFIX} final status`, {
    workoutId,
    status: statusResult.status,
    message: statusResult.message,
  });

  if (statusResult.status !== "PACE_FOR_PACE_AVAILABLE") {
    return {
      ok: false,
      code: "SEGMENT_PARSE_FAILED",
      message: statusResult.failureReason ?? statusResult.message ?? "Splits unavailable.",
      workoutId,
      activityId,
    };
  }

  return {
    ok: true,
    workoutId,
    activityId,
    paceForPaceStatus: statusResult.status,
    message: statusResult.message,
    performanceAnalysis: loaded.performanceAnalysis,
    workout: loaded.workout,
  };
}
