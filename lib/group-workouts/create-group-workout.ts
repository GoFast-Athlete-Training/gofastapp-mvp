import { prisma } from "@/lib/prisma";
import { segmentSnapshotDocumentFromDbRows } from "@/lib/training/workout-segment-snapshot";
import type { GroupWorkoutSegmentInput } from "./types";

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function normalizeWorkoutType(raw: string | undefined | null): "Easy" | "Tempo" | "Intervals" | "LongRun" | "Race" {
  const allowed = ["Easy", "Tempo", "Intervals", "LongRun", "Race"] as const;
  const v = raw?.trim();
  if (v && (allowed as readonly string[]).includes(v)) return v as (typeof allowed)[number];
  return "Intervals";
}

export type CreateGroupWorkoutInput = {
  runClubId: string;
  createdByStaffId?: string | null;
  title: string;
  description?: string | null;
  workoutType?: string | null;
  segments: GroupWorkoutSegmentInput[];
};

export async function createGroupWorkout(input: CreateGroupWorkoutInput) {
  const runClubId = input.runClubId.trim();
  if (!runClubId) throw new Error("runClubId is required");

  const title = input.title.trim();
  if (!title) throw new Error("title is required");

  if (!Array.isArray(input.segments) || input.segments.length === 0) {
    throw new Error("At least one segment is required");
  }

  const club = await prisma.run_clubs.findUnique({
    where: { id: runClubId },
    select: { id: true },
  });
  if (!club) throw new Error("runClubId not found");

  const workoutType = normalizeWorkoutType(input.workoutType);

  const estimatedMiles = input.segments.reduce((sum, seg) => {
    const reps = Math.max(1, seg.repeatCount ?? 1);
    if (seg.durationType === "DISTANCE") return sum + seg.durationValue * reps;
    return sum;
  }, 0);

  const workout = await prisma.workouts.create({
    data: {
      id: generateId("workout"),
      title,
      description: input.description?.trim() || null,
      workoutType,
      athleteId: null,
      runClubId,
      createdByStaffId: input.createdByStaffId?.trim() || null,
      scope: "GROUP",
      estimatedDistanceInMeters:
        estimatedMiles > 0 ? Math.round(estimatedMiles * 1609.34) : null,
      segments: {
        create: input.segments.map((seg, index) => ({
          id: generateId("segment"),
          stepOrder: seg.stepOrder || index + 1,
          title: seg.title,
          durationType: seg.durationType,
          durationValue: seg.durationValue,
          targets: seg.targets ?? null,
          repeatCount: seg.repeatCount ?? null,
          notes: seg.notes ?? null,
          paceTargetEncodingVersion: 2,
          recoveryDurationType: seg.recoveryDurationType?.trim() || null,
          recoveryDurationValue:
            seg.recoveryDurationValue != null && Number.isFinite(seg.recoveryDurationValue)
              ? seg.recoveryDurationValue
              : null,
        })),
      },
    },
    include: {
      segments: { orderBy: { stepOrder: "asc" } },
    },
  });

  if (workout.segments?.length) {
    const rows = [...workout.segments].sort((a, b) => a.stepOrder - b.stepOrder);
    await prisma.workouts.update({
      where: { id: workout.id },
      data: {
        segmentSnapshotJson: segmentSnapshotDocumentFromDbRows(
          rows.map((r) => ({
            stepOrder: r.stepOrder,
            title: r.title,
            durationType: r.durationType,
            durationValue: r.durationValue,
            targets: r.targets,
            repeatCount: r.repeatCount,
            notes: r.notes,
            paceTargetEncodingVersion: r.paceTargetEncodingVersion,
            recoveryDurationType: r.recoveryDurationType ?? null,
            recoveryDurationValue: r.recoveryDurationValue ?? null,
          })),
          "group_workout_create"
        ),
      },
    });
  }

  return workout;
}
