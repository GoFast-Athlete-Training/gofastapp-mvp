import { Prisma, WorkoutType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { segmentSnapshotDocumentFromDbRows } from "@/lib/training/workout-segment-snapshot";
import type { GroupWorkoutSegmentInput } from "@/lib/group-workouts/types";

function normalizeWorkoutType(
  raw: string | undefined | null
): "Easy" | "Tempo" | "Intervals" | "LongRun" | "Race" {
  const allowed = ["Easy", "Tempo", "Intervals", "LongRun", "Race"] as const;
  const v = raw?.trim();
  if (v && (allowed as readonly string[]).includes(v)) return v as (typeof allowed)[number];
  return "Intervals";
}

export type UpsertRunPlannedWorkoutInput = {
  cityRunId: string;
  title: string;
  description?: string | null;
  workoutType?: string | null;
  date: Date;
  segments: GroupWorkoutSegmentInput[];
};

/** Upsert athlete-null planned_workouts template linked via city_runs.plannedWorkoutId */
export async function upsertRunPlannedWorkoutForRun(input: UpsertRunPlannedWorkoutInput) {
  const cityRunId = input.cityRunId.trim();
  if (!cityRunId) throw new Error("cityRunId is required");

  const title = input.title.trim();
  if (!title) throw new Error("title is required");
  if (!Array.isArray(input.segments) || input.segments.length === 0) {
    throw new Error("At least one segment is required");
  }

  const run = await prisma.city_runs.findUnique({
    where: { id: cityRunId },
    select: { id: true, date: true, plannedWorkoutId: true },
  });
  if (!run) throw new Error("cityRunId not found");

  const workoutType = normalizeWorkoutType(input.workoutType);
  const estimatedMiles = input.segments.reduce((sum, seg) => {
    const reps = Math.max(1, seg.repeatCount ?? 1);
    if (seg.durationType === "DISTANCE") return sum + seg.durationValue * reps;
    return sum;
  }, 0);

  const segmentCreates = input.segments.map((seg, index) => ({
    stepOrder: seg.stepOrder || index + 1,
    title: seg.title,
    durationType: seg.durationType,
    durationValue: seg.durationValue,
    targets: seg.targets != null ? (seg.targets as Prisma.InputJsonValue) : Prisma.JsonNull,
    repeatCount: seg.repeatCount ?? null,
    notes: seg.notes ?? null,
    paceTargetEncodingVersion: 2,
    recoveryDurationType: seg.recoveryDurationType?.trim() || null,
    recoveryDurationValue:
      seg.recoveryDurationValue != null && Number.isFinite(seg.recoveryDurationValue)
        ? seg.recoveryDurationValue
        : null,
    updatedAt: new Date(),
  }));

  const snapshotJson = segmentSnapshotDocumentFromDbRows(
    segmentCreates.map((s) => ({
      stepOrder: s.stepOrder,
      title: s.title,
      durationType: s.durationType,
      durationValue: s.durationValue,
      targets: s.targets === Prisma.JsonNull ? null : s.targets,
      repeatCount: s.repeatCount,
      notes: s.notes,
      paceTargetEncodingVersion: s.paceTargetEncodingVersion,
      recoveryDurationType: s.recoveryDurationType,
      recoveryDurationValue: s.recoveryDurationValue,
    })),
    "run_planned_workout"
  );

  const existingTemplateId = run.plannedWorkoutId;

  const planned = await prisma.$transaction(async (tx) => {
    let rowId = existingTemplateId;

    if (rowId) {
      await tx.planned_workout_segments.deleteMany({ where: { plannedWorkoutId: rowId } });
      await tx.planned_workouts.update({
        where: { id: rowId },
        data: {
          title,
          workoutType: workoutType as WorkoutType,
          date: input.date,
          cityRunId,
          estimatedDistanceInMeters:
            estimatedMiles > 0 ? Math.round(estimatedMiles * 1609.34) : null,
          segmentSnapshotJson: snapshotJson as Prisma.InputJsonValue,
          updatedAt: new Date(),
        },
      });
    } else {
      const created = await tx.planned_workouts.create({
        data: {
          title,
          workoutType: workoutType as WorkoutType,
          athleteId: null,
          planId: null,
          cityRunId,
          date: input.date,
          estimatedDistanceInMeters:
            estimatedMiles > 0 ? Math.round(estimatedMiles * 1609.34) : null,
          segmentSnapshotJson: snapshotJson as Prisma.InputJsonValue,
          updatedAt: new Date(),
        },
      });
      rowId = created.id;
      await tx.city_runs.update({
        where: { id: cityRunId },
        data: { plannedWorkoutId: rowId, updatedAt: new Date() },
      });
    }

    await tx.planned_workout_segments.createMany({
      data: segmentCreates.map((s) => ({ ...s, plannedWorkoutId: rowId! })),
    });

    return tx.planned_workouts.findUniqueOrThrow({
      where: { id: rowId! },
      include: {
        segments: { orderBy: { stepOrder: "asc" } },
      },
    });
  });

  return planned;
}
