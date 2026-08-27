import { Prisma, WorkoutType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function clonePlannedWorkoutForAthlete(
  templateId: string,
  athleteId: string,
  overrides: {
    cityRunId: string;
    date: Date;
    courseSnapJson?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
    cityRunMatchLabel?: string | null;
  }
) {
  const template = await prisma.planned_workouts.findUnique({
    where: { id: templateId },
    include: { segments: { orderBy: { stepOrder: "asc" } } },
  });
  if (!template) throw new Error("Template planned workout not found");

  return prisma.$transaction(async (tx) => {
    const created = await tx.planned_workouts.create({
      data: {
        title: template.title,
        workoutType: template.workoutType as WorkoutType,
        athleteId,
        planId: null,
        cityRunId: overrides.cityRunId,
        date: overrides.date,
        estimatedDistanceInMeters: template.estimatedDistanceInMeters,
        catalogueWorkoutId: template.catalogueWorkoutId,
        segmentSnapshotJson: template.segmentSnapshotJson ?? Prisma.JsonNull,
        courseSnapJson: overrides.courseSnapJson ?? Prisma.JsonNull,
        cityRunMatchLabel: overrides.cityRunMatchLabel ?? null,
        updatedAt: new Date(),
      },
    });

    if (template.segments.length > 0) {
      await tx.planned_workout_segments.createMany({
        data: template.segments.map((s) => ({
          plannedWorkoutId: created.id,
          stepOrder: s.stepOrder,
          title: s.title,
          durationType: s.durationType,
          durationValue: s.durationValue,
          targets: s.targets ?? Prisma.JsonNull,
          paceTargetEncodingVersion: s.paceTargetEncodingVersion,
          repeatCount: s.repeatCount,
          recoveryDurationType: s.recoveryDurationType,
          recoveryDurationValue: s.recoveryDurationValue,
          notes: s.notes,
          updatedAt: new Date(),
        })),
      });
    }

    return created;
  });
}

export async function resyncAthleteStampFromTemplate(
  stampId: string,
  templateId: string,
  overrides: {
    date: Date;
    courseSnapJson?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
    cityRunMatchLabel?: string | null;
  }
) {
  const template = await prisma.planned_workouts.findUnique({
    where: { id: templateId },
    include: { segments: { orderBy: { stepOrder: "asc" } } },
  });
  if (!template) return;

  await prisma.$transaction(async (tx) => {
    await tx.planned_workout_segments.deleteMany({ where: { plannedWorkoutId: stampId } });
    await tx.planned_workouts.update({
      where: { id: stampId },
      data: {
        title: template.title,
        workoutType: template.workoutType,
        date: overrides.date,
        estimatedDistanceInMeters: template.estimatedDistanceInMeters,
        segmentSnapshotJson: template.segmentSnapshotJson ?? Prisma.JsonNull,
        courseSnapJson: overrides.courseSnapJson ?? Prisma.JsonNull,
        cityRunMatchLabel: overrides.cityRunMatchLabel ?? null,
        updatedAt: new Date(),
      },
    });
    if (template.segments.length > 0) {
      await tx.planned_workout_segments.createMany({
        data: template.segments.map((s) => ({
          plannedWorkoutId: stampId,
          stepOrder: s.stepOrder,
          title: s.title,
          durationType: s.durationType,
          durationValue: s.durationValue,
          targets: s.targets ?? Prisma.JsonNull,
          paceTargetEncodingVersion: s.paceTargetEncodingVersion,
          repeatCount: s.repeatCount,
          recoveryDurationType: s.recoveryDurationType,
          recoveryDurationValue: s.recoveryDurationValue,
          notes: s.notes,
          updatedAt: new Date(),
        })),
      });
    }
  });
}
