/**
 * Match spawns an instance `workouts` row as a copy of a planned_workout prescribe tree.
 * Same-id spawn: workouts.id = planned_workouts.id (acq/prod club pattern).
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { segmentSnapshotDocumentFromDbRows } from "./workout-segment-snapshot";

const plannedInclude = {
  segments: { orderBy: { stepOrder: "asc" as const } },
  workout_catalogue: { select: { workBasePaceOffsetSecPerMile: true, name: true } },
} as const;

const spawnedInclude = {
  segments: { orderBy: { stepOrder: "asc" as const } },
  workout_catalogue: { select: { workBasePaceOffsetSecPerMile: true, name: true } },
} as const;

export type PlannedWorkoutForSpawn = Prisma.planned_workoutsGetPayload<{
  include: typeof plannedInclude;
}>;

export type SpawnedWorkoutForApply = {
  id: string;
  title: string;
  planId: string | null;
  weekNumber: number | null;
  workoutType: string;
  plannedWorkoutId: string | null;
  segments: {
    title: string;
    targets: unknown;
    stepOrder: number;
    paceTargetEncodingVersion: number;
  }[];
  workout_catalogue: { workBasePaceOffsetSecPerMile: number | null } | null;
};

export async function loadPlannedWorkoutForSpawn(
  plannedWorkoutId: string
): Promise<PlannedWorkoutForSpawn | null> {
  return prisma.planned_workouts.findUnique({
    where: { id: plannedWorkoutId },
    include: plannedInclude,
  });
}

/** Reuse an existing spawned instance for this planned day (+ optional activity), if any. */
export async function findSpawnedInstanceForPlanned(params: {
  plannedWorkoutId: string;
  garminDetailActivityId?: string;
}): Promise<SpawnedWorkoutForApply | null> {
  const activityFilter =
    params.garminDetailActivityId != null
      ? { garminDetailActivityId: params.garminDetailActivityId }
      : {};

  const sameId = await prisma.workouts.findFirst({
    where: {
      id: params.plannedWorkoutId,
      ...activityFilter,
    },
    include: spawnedInclude,
  });
  if (sameId) return spawnedRowToApplyShape(sameId);

  const legacyFk = await prisma.workouts.findFirst({
    where: {
      plannedWorkoutId: params.plannedWorkoutId,
      id: { not: params.plannedWorkoutId },
      ...activityFilter,
    },
    include: spawnedInclude,
    orderBy: { updatedAt: "desc" },
  });
  if (legacyFk) return spawnedRowToApplyShape(legacyFk);

  return null;
}

function spawnedRowToApplyShape(
  row: Prisma.workoutsGetPayload<{ include: typeof spawnedInclude }>
): SpawnedWorkoutForApply {
  return {
    id: row.id,
    title: row.title,
    planId: row.planId,
    weekNumber: row.weekNumber,
    workoutType: row.workoutType,
    plannedWorkoutId: row.plannedWorkoutId,
    segments: row.segments.map((s) => ({
      title: s.title,
      targets: s.targets,
      stepOrder: s.stepOrder,
      paceTargetEncodingVersion: s.paceTargetEncodingVersion,
    })),
    workout_catalogue: row.workout_catalogue,
  };
}

/**
 * Insert workouts + workout_segments from planned prescribe tree (no actuals).
 * Idempotent when an instance already exists at planned.id (or legacy FK row).
 */
export async function spawnWorkoutFromPlanned(
  planned: PlannedWorkoutForSpawn
): Promise<SpawnedWorkoutForApply> {
  if (!planned.segments.length) {
    throw new Error("Planned workout has no segments; rematerialize before spawn.");
  }

  const existing = await findSpawnedInstanceForPlanned({
    plannedWorkoutId: planned.id,
  });
  if (existing) return existing;

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
    "plan_day_materialize"
  );

  const instanceId = planned.id;

  await prisma.$transaction(async (tx) => {
    await tx.workouts.create({
      data: {
        id: instanceId,
        title: planned.title,
        workoutType: planned.workoutType,
        athleteId: planned.athleteId,
        plannedWorkoutId: planned.id,
        planId: planned.planId,
        date: planned.date,
        estimatedDistanceInMeters: planned.estimatedDistanceInMeters,
        catalogueWorkoutId: planned.catalogueWorkoutId,
        weekNumber: planned.weekNumber,
        dayAssigned: planned.dayAssigned,
        nOffset: planned.nOffset,
        planCycleIndex: planned.planCycleIndex,
        segmentSnapshotJson: snapshot,
        updatedAt: new Date(),
      },
    });

    await tx.workout_segments.createMany({
      data: planned.segments.map((s) => ({
        workoutId: instanceId,
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

  const spawned = await prisma.workouts.findUniqueOrThrow({
    where: { id: instanceId },
    include: spawnedInclude,
  });

  return spawnedRowToApplyShape(spawned);
}
