/**
 * Stamp a planned_workout prescribe tree onto an existing spawned workouts row.
 * Keeps workouts.id — plan is metadata + segments on the run that happened.
 */

import { prisma } from "@/lib/prisma";
import { segmentSnapshotDocumentFromDbRows } from "./workout-segment-snapshot";
import {
  loadPlannedWorkoutForSpawn,
  type PlannedWorkoutForSpawn,
} from "./spawn-workout-from-planned";
import { syncActivityDetailToLinkedWorkout } from "./apply-activity-to-workout";

const spawnedInclude = {
  segments: { orderBy: { stepOrder: "asc" as const } },
  workout_catalogue: { select: { workBasePaceOffsetSecPerMile: true, name: true } },
} as const;

export async function stampPlannedPrescribeOntoWorkout(params: {
  workoutId: string;
  planned: PlannedWorkoutForSpawn;
}): Promise<void> {
  const { workoutId, planned } = params;
  if (!planned.segments.length) {
    throw new Error("Planned workout has no segments");
  }

  const snapshot = segmentSnapshotDocumentFromDbRows(
    planned.segments.map((s) => ({
      stepOrder: s.stepOrder,
      title: s.title,
      durationType: s.durationType,
      durationValue: s.durationValue,
      targets: s.targets,
      repeatCount: s.repeatCount,
      notes: s.notes,
      paceTargetEncodingVersion: s.paceTargetEncodingVersion,
      recoveryDurationType: s.recoveryDurationType,
      recoveryDurationValue: s.recoveryDurationValue,
    })),
    "plan_snap_onto_spawn"
  );

  await prisma.$transaction(async (tx) => {
    await tx.workout_segment_laps.deleteMany({
      where: { segment: { workoutId } },
    });
    await tx.workout_segments.deleteMany({ where: { workoutId } });

    await tx.workouts.update({
      where: { id: workoutId },
      data: {
        title: planned.title,
        workoutType: planned.workoutType,
        plannedWorkoutId: planned.id,
        planId: planned.planId,
        estimatedDistanceInMeters: planned.estimatedDistanceInMeters,
        catalogueWorkoutId: planned.catalogueWorkoutId,
        weekNumber: planned.weekNumber,
        dayAssigned: planned.dayAssigned,
        nOffset: planned.nOffset,
        planCycleIndex: planned.planCycleIndex,
        segmentSnapshotJson: snapshot,
        segmentExecutionStatus: null,
        segmentExecutionLapCount: null,
        segmentExecutionSegmentCount: null,
        splitsStamped: false,
        updatedAt: new Date(),
      },
    });

    await tx.workout_segments.createMany({
      data: planned.segments.map((s) => ({
        workoutId,
        stepOrder: s.stepOrder,
        title: s.title,
        durationType: s.durationType,
        durationValue: s.durationValue,
        targets: s.targets as object | undefined,
        repeatCount: s.repeatCount ?? undefined,
        paceTargetEncodingVersion: s.paceTargetEncodingVersion,
        recoveryDurationType: s.recoveryDurationType,
        recoveryDurationValue: s.recoveryDurationValue,
        notes: s.notes,
        updatedAt: new Date(),
      })),
    });
  });
}

/** Load planned row and copy prescribe segments onto an existing workout id. */
export async function stampPlanOntoWorkoutFromPlannedId(params: {
  workoutId: string;
  plannedWorkoutId: string;
}): Promise<void> {
  const planned = await loadPlannedWorkoutForSpawn(params.plannedWorkoutId);
  if (!planned) throw new Error("Planned workout not found");
  await stampPlannedPrescribeOntoWorkout({ workoutId: params.workoutId, planned });
}

/** Re-bolt FIT/detail laps and pace stamp after segments land on the workout. */
export async function reboltLapsAfterPlanStamp(workoutId: string): Promise<void> {
  const workout = await prisma.workouts.findUnique({
    where: { id: workoutId },
    select: { garminDetailActivityId: true },
  });
  if (!workout?.garminDetailActivityId) return;
  try {
    await syncActivityDetailToLinkedWorkout(workout.garminDetailActivityId);
  } catch (err) {
    console.warn("[stamp-plan-onto-workout] rebolt failed", workoutId, err);
  }
}

export async function loadWorkoutForApplyAfterStamp(
  workoutId: string
): Promise<
  import("./apply-activity-to-workout").WorkoutForActivityApply | null
> {
  const row = await prisma.workouts.findUnique({
    where: { id: workoutId },
    include: spawnedInclude,
  });
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    planId: row.planId,
    weekNumber: row.weekNumber,
    workoutType: row.workoutType,
    segments: row.segments.map((s) => ({
      title: s.title,
      targets: s.targets,
      stepOrder: s.stepOrder,
      paceTargetEncodingVersion: s.paceTargetEncodingVersion,
    })),
    workout_catalogue: row.workout_catalogue,
  };
}
