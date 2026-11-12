/**
 * MVP1: find / attach / analyze on a stored matched workout (no ingest match swap).
 *
 * Usage:
 *   node scripts/with-env-local.mjs npx tsx scripts/find-attach-analyze.ts --workout-id=<id>
 *   node scripts/with-env-local.mjs npx tsx scripts/find-attach-analyze.ts --activity-id=<id>
 */

import { prisma } from "../lib/prisma";
import { parseActivityToSegmentExecution } from "../lib/training/activity-to-segment-execution";
import { stampPaceDeltas } from "../lib/training/stamp-pace-deltas";
import { computeWorkoutPerformanceAnalysis } from "../lib/training/workout-performance-analysis";
import type { FitLapDataPayload } from "../lib/garmin-events/fit-lap-types";
import { formatSecPerMile } from "../lib/training/race-projection";

function readArg(name: string): string | null {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() || null : null;
}

function fitLapCount(fitLapData: unknown): number {
  if (fitLapData == null || typeof fitLapData !== "object") return 0;
  const laps = (fitLapData as FitLapDataPayload).laps;
  return Array.isArray(laps) ? laps.length : 0;
}

async function resolveIds(): Promise<{ workoutId: string; activityId: string } | null> {
  const workoutIdArg = readArg("workout-id");
  const activityIdArg = readArg("activity-id");

  if (workoutIdArg) {
    const workout = await prisma.workouts.findUnique({
      where: { id: workoutIdArg },
      select: { id: true, garminDetailActivityId: true },
    });
    if (!workout?.garminDetailActivityId) {
      console.error("Workout not found or not linked to an activity");
      return null;
    }
    return { workoutId: workout.id, activityId: workout.garminDetailActivityId };
  }

  if (activityIdArg) {
    const workout = await prisma.workouts.findFirst({
      where: { garminDetailActivityId: activityIdArg },
      select: { id: true, garminDetailActivityId: true },
    });
    if (!workout?.garminDetailActivityId) {
      console.error("No workout linked to this activity");
      return null;
    }
    return { workoutId: workout.id, activityId: workout.garminDetailActivityId };
  }

  console.error("Pass --workout-id= or --activity-id=");
  return null;
}

async function main() {
  const ids = await resolveIds();
  if (!ids) process.exit(1);

  const { workoutId, activityId } = ids;

  const workout = await prisma.workouts.findUnique({
    where: { id: workoutId },
    include: {
      segments: { orderBy: { stepOrder: "asc" } },
      garmin_detail_activity: {
        select: { id: true, fitLapData: true, detailData: true },
      },
    },
  });

  if (!workout) {
    console.error("Workout not found");
    process.exit(1);
  }

  const fitLaps = fitLapCount(workout.garmin_detail_activity?.fitLapData);
  const hasDetail =
    workout.garmin_detail_activity?.detailData != null ||
    workout.garmin_detail_activity?.fitLapData != null;

  console.log("FIND", {
    workoutId,
    activityId,
    plannedWorkoutId: workout.plannedWorkoutId,
    planId: workout.planId,
    segmentCount: workout.segments.length,
    fitLapCount: fitLaps,
    hasDetail,
    segmentExecutionStatus: workout.segmentExecutionStatus,
  });

  if (!hasDetail) {
    console.error("No FIT or detail on activity — cannot attach");
    process.exit(1);
  }
  if (workout.segments.length === 0) {
    console.error("Workout has no segments — stamp plan onto this workout id first");
    process.exit(1);
  }

  const attach = await parseActivityToSegmentExecution({
    activityId,
    workoutId,
  });
  console.log("ATTACH", attach);

  if (!attach.ok || attach.status !== "ALIGNED") {
    process.exit(1);
  }

  const stamp = await stampPaceDeltas({ workoutId, activityId });
  console.log("STAMP", stamp);

  const reloaded = await prisma.workouts.findUnique({
    where: { id: workoutId },
    include: {
      segments: {
        orderBy: { stepOrder: "asc" },
        include: {
          segment_laps: {
            where: { activityId },
            orderBy: { lapIndex: "asc" },
          },
        },
      },
      garmin_detail_activity: {
        select: { detailData: true, fitLapData: true },
      },
    },
  });
  if (!reloaded) process.exit(1);

  const analysis = computeWorkoutPerformanceAnalysis({
    workoutType: reloaded.workoutType,
    planId: reloaded.planId,
    plannedWorkoutId: reloaded.plannedWorkoutId,
    targetPaceSecPerMile: reloaded.targetPaceSecPerMile,
    targetPaceSecPerMileHigh: reloaded.targetPaceSecPerMileHigh,
    paceDeltaSecPerMile: reloaded.paceDeltaSecPerMile,
    actualAvgPaceSecPerMile: reloaded.actualAvgPaceSecPerMile,
    actualDistanceMeters: reloaded.actualDistanceMeters,
    actualDurationSeconds: reloaded.actualDurationSeconds,
    estimatedDistanceInMeters: reloaded.estimatedDistanceInMeters,
    completedActivityDetailJson: reloaded.completedActivityDetailJson,
    garminDetailActivityId: reloaded.garminDetailActivityId,
    garmin_detail_activity: reloaded.garmin_detail_activity,
    segmentExecutionStatus: reloaded.segmentExecutionStatus,
    segmentExecutionLapCount: reloaded.segmentExecutionLapCount,
    segmentExecutionSegmentCount: reloaded.segmentExecutionSegmentCount,
    segments: reloaded.segments.map((s) => ({
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
      segment_laps: s.segment_laps,
    })),
  });

  console.log("ANALYZE", {
    executionHeadline: analysis.executionHeadline,
    canJudgeTargetPace: analysis.canJudgeTargetPace,
    analysisMode: analysis.analysisMode,
    phaseAwareCount: analysis.phaseAwareLaps.length,
  });

  for (const lap of analysis.phaseAwareLaps) {
    const prescribed = formatSecPerMile(lap.targetPaceSecPerMile);
    const actual = formatSecPerMile(lap.paceSecPerMile);
  console.log(
      `  lap ${lap.lapIndex} [${lap.phase}] actual=${actual ?? "—"} prescribed=${prescribed ?? "—"} ${lap.vsPlanPaceLabel ?? ""}`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
