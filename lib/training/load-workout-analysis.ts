/**
 * Load workout row + compute performance analysis (shared by GET and Pace for Pace resolve).
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { parseActivityToSegmentExecution } from "./activity-to-segment-execution";
import { stampPaceDeltasAfterSplits } from "./stamp-pace-deltas";
import {
  computeWorkoutPerformanceAnalysis,
  type PerformanceAnalysisWorkoutInput,
  type WorkoutPerformanceAnalysis,
} from "./workout-performance-analysis";

export async function restampRepeatedRepsIfNeeded(workout: {
  id: string;
  garminDetailActivityId: string | null;
  segments: Array<{
    repeatCount?: number | null;
    durationValue?: number | null;
    segment_laps: Array<{
      distanceMiles?: number | null;
      paceDeltaSecPerMile?: number | null;
    }>;
  }>;
}): Promise<boolean> {
  if (!workout.garminDetailActivityId) return false;
  if (!repeatedRepsNeedRestamp(workout.segments)) return false;
  await stampPaceDeltasAfterSplits({
    workoutId: workout.id,
    activityId: workout.garminDetailActivityId,
  });
  return true;
}

function repeatedRepsNeedRestamp(
  segments: Array<{
    repeatCount?: number | null;
    durationValue?: number | null;
    segment_laps: Array<{
      distanceMiles?: number | null;
      paceDeltaSecPerMile?: number | null;
    }>;
  }>
): boolean {
  for (const seg of segments) {
    const reps = seg.repeatCount ?? 1;
    const repMiles = seg.durationValue;
    if (reps <= 1 || repMiles == null || repMiles <= 0 || repMiles >= 0.9) continue;
    for (const lap of seg.segment_laps) {
      const miles = lap.distanceMiles;
      if (miles == null || !Number.isFinite(miles)) continue;
      const near = miles >= repMiles * 0.75 && miles <= repMiles * 1.35;
      const short = miles < repMiles * 0.75;
      if (near && lap.paceDeltaSecPerMile == null) return true;
      if (short && lap.paceDeltaSecPerMile != null) return true;
    }
  }
  return false;
}

const workoutAnalysisInclude = {
  segments: {
    orderBy: { stepOrder: "asc" as const },
    include: {
      segment_laps: { orderBy: { lapIndex: "asc" as const } },
    },
  },
  garmin_detail_activity: {
    select: {
      id: true,
      activityName: true,
      activityType: true,
      startTime: true,
      ingestionStatus: true,
      distance: true,
      duration: true,
      averageSpeed: true,
      averageHeartRate: true,
      detailData: true,
      fitLapData: true,
      hydratedAt: true,
    },
  },
} as const;

export type WorkoutWithAnalysis = Prisma.workoutsGetPayload<{
  include: typeof workoutAnalysisInclude;
}>;

export type LoadedWorkoutForAnalysis = {
  workout: WorkoutWithAnalysis;
  analysisInput: PerformanceAnalysisWorkoutInput;
  performanceAnalysis: WorkoutPerformanceAnalysis;
};

export type RetrySegmentBoltInput = {
  id: string;
  garminDetailActivityId: string | null;
  completedActivityDetailJson: unknown;
  segmentExecutionStatus: string | null;
  segments: Array<{ segment_laps: unknown[] }>;
  garmin_detail_activity: { detailData: unknown; fitLapData?: unknown } | null;
};

/** Run bolt + pace stamp when detail exists but segment_laps are empty. Returns true if bolt succeeded. */
export async function retrySegmentBoltIfNeeded(
  workout: RetrySegmentBoltInput
): Promise<boolean> {
  const hasLaps = workout.segments.some((s) => s.segment_laps.length > 0);
  const hasDetail =
    workout.garmin_detail_activity?.detailData != null ||
    workout.garmin_detail_activity?.fitLapData != null ||
    workout.completedActivityDetailJson != null;
  const activityId = workout.garminDetailActivityId;

  if (
    !activityId ||
    hasLaps ||
    !hasDetail ||
    workout.segmentExecutionStatus === "ALIGNED"
  ) {
    return false;
  }

  const parseResult = await parseActivityToSegmentExecution({
    activityId,
    workoutId: workout.id,
  });
  if (!parseResult.ok) return false;

  await stampPaceDeltasAfterSplits({ workoutId: workout.id, activityId });
  return true;
}

export async function loadWorkoutForAnalysis(params: {
  workoutId: string;
  athleteId: string;
}): Promise<LoadedWorkoutForAnalysis | null> {
  let workout = await prisma.workouts.findFirst({
    where: { id: params.workoutId, athleteId: params.athleteId },
    include: workoutAnalysisInclude,
  });

  if (!workout) return null;

  if (await retrySegmentBoltIfNeeded(workout)) {
    const reloaded = await prisma.workouts.findFirst({
      where: { id: params.workoutId, athleteId: params.athleteId },
      include: workoutAnalysisInclude,
    });
    if (reloaded) workout = reloaded;
  } else if (await restampRepeatedRepsIfNeeded(workout)) {
    const reloaded = await prisma.workouts.findFirst({
      where: { id: params.workoutId, athleteId: params.athleteId },
      include: workoutAnalysisInclude,
    });
    if (reloaded) workout = reloaded;
  }

  const analysisInput: PerformanceAnalysisWorkoutInput = {
    workoutType: workout.workoutType,
    planId: workout.planId,
    plannedWorkoutId: workout.plannedWorkoutId,
    targetPaceSecPerMile: workout.targetPaceSecPerMile,
    targetPaceSecPerMileHigh: workout.targetPaceSecPerMileHigh,
    paceDeltaSecPerMile: workout.paceDeltaSecPerMile,
    actualAvgPaceSecPerMile: workout.actualAvgPaceSecPerMile,
    actualDistanceMeters: workout.actualDistanceMeters,
    actualDurationSeconds: workout.actualDurationSeconds,
    estimatedDistanceInMeters: workout.estimatedDistanceInMeters,
    completedActivityDetailJson: workout.completedActivityDetailJson,
    garminDetailActivityId: workout.garminDetailActivityId,
    garmin_detail_activity: workout.garmin_detail_activity,
    segmentExecutionStatus: workout.segmentExecutionStatus,
    segmentExecutionLapCount: workout.segmentExecutionLapCount,
    segmentExecutionSegmentCount: workout.segmentExecutionSegmentCount,
    segments: workout.segments.map((s) => ({
      id: s.id,
      title: s.title,
      stepOrder: s.stepOrder,
      targets: s.targets,
      paceTargetEncodingVersion: s.paceTargetEncodingVersion,
      actualPaceSecPerMile: s.actualPaceSecPerMile,
      actualDurationSeconds: s.actualDurationSeconds,
      actualDistanceMiles: s.actualDistanceMiles,
      durationValue: s.durationValue,
      repeatCount: s.repeatCount,
      segment_laps: workout.garminDetailActivityId
        ? s.segment_laps.filter((lap) => lap.activityId === workout.garminDetailActivityId)
        : s.segment_laps,
    })),
  };

  const performanceAnalysis = computeWorkoutPerformanceAnalysis(analysisInput);

  return { workout, analysisInput, performanceAnalysis };
}

export async function resolveWorkoutIdFromActivity(params: {
  activityId: string;
  athleteId: string;
}): Promise<string | null> {
  const activity = await prisma.athlete_activities.findFirst({
    where: { id: params.activityId, athleteId: params.athleteId },
    select: { id: true },
  });
  if (!activity) return null;

  const linked = await prisma.workouts.findFirst({
    where: { garminDetailActivityId: activity.id, athleteId: params.athleteId },
    select: { id: true },
  });
  return linked?.id ?? null;
}
