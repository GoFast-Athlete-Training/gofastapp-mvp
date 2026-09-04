/**
 * Resolve `/workouts/[id]` API ids to planned prescribe rows and/or spawned instance rows.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { newEntityId } from "@/lib/training/new-entity-id";
import { segmentSnapshotDocumentFromDbRows } from "@/lib/training/workout-segment-snapshot";
import { resolveSpawnedWorkoutForPlanned } from "@/lib/training/match-planned-workout";

export type ResolvedWorkoutTarget =
  | { kind: "standalone"; workoutId: string }
  | {
      kind: "planned";
      plannedWorkoutId: string;
      /** Spawned instance when present (often same id as planned). */
      instanceWorkoutId: string | null;
    };

export type PrescribeSegmentInput = {
  stepOrder: number;
  title: string;
  durationType: string;
  durationValue: number;
  targets: Prisma.InputJsonValue | null;
  repeatCount: number | null;
  notes: string | null;
  recoveryDurationType: string | null;
  recoveryDurationValue: number | null;
};

/** Resolve URL id to planned prescribe and/or instance workout rows. */
export async function resolveWorkoutTargetForAthlete(
  id: string,
  athleteId: string
): Promise<ResolvedWorkoutTarget | null> {
  const [plannedById, workoutById] = await Promise.all([
    prisma.planned_workouts.findFirst({ where: { id, athleteId } }),
    prisma.workouts.findFirst({ where: { id, athleteId } }),
  ]);

  if (plannedById) {
    return {
      kind: "planned",
      plannedWorkoutId: plannedById.id,
      instanceWorkoutId: workoutById?.id ?? null,
    };
  }

  if (workoutById) {
    if (workoutById.plannedWorkoutId) {
      const planned = await prisma.planned_workouts.findFirst({
        where: { id: workoutById.plannedWorkoutId, athleteId },
      });
      if (planned) {
        return {
          kind: "planned",
          plannedWorkoutId: planned.id,
          instanceWorkoutId: workoutById.id,
        };
      }
    }
    return { kind: "standalone", workoutId: workoutById.id };
  }

  return null;
}

/** Push state for calendar gating (planned row is source of truth for plan days). */
export async function resolveWorkoutPushStateForAthlete(
  id: string,
  athleteId: string
): Promise<{ workoutPushed: boolean; workoutEditedAfterPush: boolean } | null> {
  const target = await resolveWorkoutTargetForAthlete(id, athleteId);
  if (!target) return null;

  if (target.kind === "planned") {
    const planned = await prisma.planned_workouts.findFirst({
      where: { id: target.plannedWorkoutId, athleteId },
      select: { workoutPushed: true, workoutEditedAfterPush: true },
    });
    if (!planned) return null;
    return {
      workoutPushed: planned.workoutPushed,
      workoutEditedAfterPush: planned.workoutEditedAfterPush,
    };
  }

  return { workoutPushed: false, workoutEditedAfterPush: false };
}

/** Instance row for mutations that only exist on `workouts` (skip, coach feedback). */
export async function resolveInstanceWorkoutIdForAthlete(
  id: string,
  athleteId: string,
  options?: { spawnIfPlanned?: boolean }
): Promise<string | null> {
  const target = await resolveWorkoutTargetForAthlete(id, athleteId);
  if (!target) return null;
  if (target.kind === "standalone") return target.workoutId;
  if (target.instanceWorkoutId) return target.instanceWorkoutId;
  if (options?.spawnIfPlanned) {
    return resolveSpawnedWorkoutForPlanned(target.plannedWorkoutId);
  }
  return null;
}

export type PrescribePatchData = {
  title?: string;
  description?: string | null;
  date?: Date | null;
  estimatedDistanceInMeters?: number | null;
};

/** Apply prescribe metadata edits; planned row is authoritative for plan days. */
export async function applyPrescribePatchForAthlete(params: {
  id: string;
  athleteId: string;
  data: PrescribePatchData;
}): Promise<{ target: ResolvedWorkoutTarget; dateChangeWarning?: string } | null> {
  const target = await resolveWorkoutTargetForAthlete(params.id, params.athleteId);
  if (!target) return null;

  if (target.kind === "standalone") {
    const patch: PrescribePatchData = { ...params.data };
    if (Object.keys(patch).length === 0) return { target };

    await prisma.workouts.update({
      where: { id: target.workoutId },
      data: patch,
    });
    return { target };
  }

  const plannedData: {
    title?: string;
    date?: Date;
    estimatedDistanceInMeters?: number | null;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (params.data.title !== undefined) plannedData.title = params.data.title;
  if (params.data.date !== undefined && params.data.date != null) {
    plannedData.date = params.data.date;
  }
  if (params.data.estimatedDistanceInMeters !== undefined) {
    plannedData.estimatedDistanceInMeters = params.data.estimatedDistanceInMeters;
  }

  if (Object.keys(plannedData).length > 1) {
    const existing = await prisma.planned_workouts.findFirst({
      where: { id: target.plannedWorkoutId },
      select: { workoutPushed: true },
    });
    await prisma.planned_workouts.update({
      where: { id: target.plannedWorkoutId },
      data: {
        ...plannedData,
        ...(existing?.workoutPushed ? { workoutEditedAfterPush: true } : {}),
      },
    });
  }

  if (target.instanceWorkoutId) {
    const instancePatch: PrescribePatchData = { ...params.data };
    if (Object.keys(instancePatch).length > 0) {
      await prisma.workouts.update({
        where: { id: target.instanceWorkoutId },
        data: instancePatch,
      });
    }
  }

  return { target };
}

function snapshotFromSegments(normalized: PrescribeSegmentInput[]) {
  return segmentSnapshotDocumentFromDbRows(
    normalized.map((seg, index) => ({
      stepOrder: seg.stepOrder ?? index + 1,
      title: seg.title,
      durationType: seg.durationType === "TIME" ? "TIME" : "DISTANCE",
      durationValue: seg.durationValue,
      targets: seg.targets,
      repeatCount: seg.repeatCount,
      notes: seg.notes,
      paceTargetEncodingVersion: 2,
      recoveryDurationType: seg.recoveryDurationType,
      recoveryDurationValue: seg.recoveryDurationValue,
    })),
    "segments_put"
  );
}

/** Replace prescribe segments on planned and/or standalone instance rows. */
export async function replacePrescribeSegmentsForAthlete(params: {
  id: string;
  athleteId: string;
  normalized: PrescribeSegmentInput[];
}): Promise<ResolvedWorkoutTarget | null> {
  const target = await resolveWorkoutTargetForAthlete(params.id, params.athleteId);
  if (!target) return null;

  const segmentSnapshotJson = snapshotFromSegments(params.normalized);

  if (target.kind === "standalone") {
    const workoutId = target.workoutId;
    await prisma.$transaction(async (tx) => {
      await tx.workout_segments.deleteMany({ where: { workoutId } });
      await tx.workout_segments.createMany({
        data: params.normalized.map((seg, index) => ({
          id: newEntityId(),
          workoutId,
          stepOrder: seg.stepOrder ?? index + 1,
          title: seg.title,
          durationType: seg.durationType === "TIME" ? "TIME" : "DISTANCE",
          durationValue: seg.durationValue,
          targets:
            seg.targets === null ? Prisma.DbNull : (seg.targets as Prisma.InputJsonValue),
          repeatCount: seg.repeatCount,
          notes: seg.notes,
          paceTargetEncodingVersion: 2,
          recoveryDurationType: seg.recoveryDurationType,
          recoveryDurationValue: seg.recoveryDurationValue,
        })),
      });
      await tx.workouts.update({
        where: { id: workoutId },
        data: { segmentSnapshotJson },
      });
    });
    return target;
  }

  const plannedWorkoutId = target.plannedWorkoutId;
  await prisma.$transaction(async (tx) => {
    await tx.planned_workout_segments.deleteMany({ where: { plannedWorkoutId } });
    await tx.planned_workout_segments.createMany({
      data: params.normalized.map((seg, index) => ({
        plannedWorkoutId,
        stepOrder: seg.stepOrder ?? index + 1,
        title: seg.title,
        durationType: seg.durationType === "TIME" ? "TIME" : "DISTANCE",
        durationValue: seg.durationValue,
        targets:
          seg.targets === null ? Prisma.DbNull : (seg.targets as Prisma.InputJsonValue),
        repeatCount: seg.repeatCount,
        notes: seg.notes,
        paceTargetEncodingVersion: 2,
        recoveryDurationType: seg.recoveryDurationType,
        recoveryDurationValue: seg.recoveryDurationValue,
        updatedAt: new Date(),
      })),
    });
    await tx.planned_workouts.update({
      where: { id: plannedWorkoutId },
      data: {
        segmentSnapshotJson,
        updatedAt: new Date(),
        ...((
          await tx.planned_workouts.findFirst({
            where: { id: plannedWorkoutId },
            select: { workoutPushed: true },
          })
        )?.workoutPushed
          ? { workoutEditedAfterPush: true }
          : {}),
      },
    });

    if (target.instanceWorkoutId) {
      const instanceId = target.instanceWorkoutId;
      await tx.workout_segments.deleteMany({ where: { workoutId: instanceId } });
      await tx.workout_segments.createMany({
        data: params.normalized.map((seg, index) => ({
          id: newEntityId(),
          workoutId: instanceId,
          stepOrder: seg.stepOrder ?? index + 1,
          title: seg.title,
          durationType: seg.durationType === "TIME" ? "TIME" : "DISTANCE",
          durationValue: seg.durationValue,
          targets:
            seg.targets === null ? Prisma.DbNull : (seg.targets as Prisma.InputJsonValue),
          repeatCount: seg.repeatCount,
          notes: seg.notes,
          paceTargetEncodingVersion: 2,
          recoveryDurationType: seg.recoveryDurationType,
          recoveryDurationValue: seg.recoveryDurationValue,
        })),
      });
      await tx.workouts.update({
        where: { id: instanceId },
        data: { segmentSnapshotJson, updatedAt: new Date() },
      });
    }
  });

  return target;
}

export type PrescribeCloneSource = {
  title: string;
  description: string | null;
  workoutType: string;
  catalogueWorkoutId: string | null;
  estimatedDistanceInMeters: number | null;
  segmentSnapshotJson: Prisma.JsonValue | null;
  segments: {
    stepOrder: number;
    title: string;
    durationType: string;
    durationValue: number;
    targets: Prisma.JsonValue | null;
    repeatCount: number | null;
    notes: string | null;
    paceTargetEncodingVersion: number;
    recoveryDurationType: string | null;
    recoveryDurationValue: number | null;
  }[];
};

/** Load prescribe tree for duplicate / clone flows. */
export async function loadPrescribeCloneSourceForAthlete(
  id: string,
  athleteId: string
): Promise<PrescribeCloneSource | null> {
  const target = await resolveWorkoutTargetForAthlete(id, athleteId);
  if (!target) return null;

  if (target.kind === "planned") {
    const planned = await prisma.planned_workouts.findFirst({
      where: { id: target.plannedWorkoutId, athleteId },
      include: { segments: { orderBy: { stepOrder: "asc" } } },
    });
    if (!planned) return null;
    return {
      title: planned.title,
      description: null,
      workoutType: planned.workoutType,
      catalogueWorkoutId: planned.catalogueWorkoutId,
      estimatedDistanceInMeters: planned.estimatedDistanceInMeters,
      segmentSnapshotJson: planned.segmentSnapshotJson,
      segments: planned.segments,
    };
  }

  const workout = await prisma.workouts.findFirst({
    where: { id: target.workoutId, athleteId },
    include: { segments: { orderBy: { stepOrder: "asc" } } },
  });
  if (!workout) return null;
  return {
    title: workout.title,
    description: workout.description,
    workoutType: workout.workoutType,
    catalogueWorkoutId: workout.catalogueWorkoutId,
    estimatedDistanceInMeters: workout.estimatedDistanceInMeters,
    segmentSnapshotJson: workout.segmentSnapshotJson,
    segments: workout.segments,
  };
}
