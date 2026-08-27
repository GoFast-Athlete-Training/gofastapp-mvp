import { prisma } from "@/lib/prisma";
import { upsertClubPlannedWorkoutForRun } from "@/lib/club-planned-workouts/create-club-planned-workout";
import type { GroupWorkoutSegmentInput } from "@/lib/group-workouts/types";

/** After series advance, clone prior run's planned template onto the new city_run row. */
export async function cloneClubPlannedTemplateToRun(
  priorRunId: string,
  newRunId: string,
  runDate: Date
): Promise<string | null> {
  const prior = await prisma.city_runs.findUnique({
    where: { id: priorRunId },
    select: {
      plannedWorkoutId: true,
      plannedWorkout: {
        include: { segments: { orderBy: { stepOrder: "asc" } } },
      },
    },
  });
  const template = prior?.plannedWorkout;
  if (!template?.segments?.length) return null;

  const segments: GroupWorkoutSegmentInput[] = template.segments.map((s) => ({
    stepOrder: s.stepOrder,
    title: s.title,
    durationType: s.durationType as "DISTANCE" | "TIME",
    durationValue: s.durationValue,
    targets: s.targets as GroupWorkoutSegmentInput["targets"],
    repeatCount: s.repeatCount,
    notes: s.notes,
    recoveryDurationType: s.recoveryDurationType,
    recoveryDurationValue: s.recoveryDurationValue,
  }));

  const created = await upsertClubPlannedWorkoutForRun({
    cityRunId: newRunId,
    title: template.title,
    workoutType: template.workoutType,
    date: runDate,
    segments,
  });
  return created.id;
}
