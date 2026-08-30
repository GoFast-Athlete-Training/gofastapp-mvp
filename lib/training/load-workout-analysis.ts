/**
 * Load workout row + compute performance analysis (shared by GET and Pace for Pace resolve).
 */

import { prisma } from "@/lib/prisma";
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
  matched_activity: {
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

export type LoadedWorkoutForAnalysis = Awaited<
  ReturnType<typeof loadWorkoutForAnalysis>
>;

export async function loadWorkoutForAnalysis(params: {
  workoutId: string;
  athleteId: string;
}): Promise<{
  workout: NonNullable<Awaited<ReturnType<typeof prisma.workouts.findFirst>>>;
  analysisInput: PerformanceAnalysisWorkoutInput;
  performanceAnalysis: WorkoutPerformanceAnalysis;
} | null> {
  const workout = await prisma.workouts.findFirst({
    where: { id: params.workoutId, athleteId: params.athleteId },
    include: workoutAnalysisInclude,
  });

  if (!workout) return null;

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
    matchedActivityId: workout.matchedActivityId,
    matched_activity: workout.matched_activity,
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
    where: { matchedActivityId: activity.id, athleteId: params.athleteId },
    select: { id: true },
  });
  return linked?.id ?? null;
}
