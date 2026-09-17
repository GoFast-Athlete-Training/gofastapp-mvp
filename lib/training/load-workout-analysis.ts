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

export async function retrySegmentBoltIfNeeded(
  workout: WorkoutWithAnalysis
): Promise<WorkoutWithAnalysis> {
  const hasLaps = workout.segments.some((s) => s.segment_laps.length > 0);
  const hasDetail =
    workout.garmin_detail_activity?.detailData != null ||
    workout.completedActivityDetailJson != null;
  const activityId = workout.garminDetailActivityId;

  if (
    !activityId ||
    hasLaps ||
    !hasDetail ||
    workout.segmentExecutionStatus === "ALIGNED"
  ) {
    return workout;
  }

  const parseResult = await parseActivityToSegmentExecution({
    activityId,
    workoutId: workout.id,
  });
  if (!parseResult.ok) return workout;

  await stampPaceDeltasAfterSplits({ workoutId: workout.id, activityId });

  const reloaded = await prisma.workouts.findFirst({
    where: { id: workout.id },
    include: workoutAnalysisInclude,
  });
  return reloaded ?? workout;
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

  workout = await retrySegmentBoltIfNeeded(workout);

  const analysisInput: PerformanceAnalysisWorkoutInput = {
    workoutType: workout.workoutType,
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
      segment_laps: s.segment_laps,
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
