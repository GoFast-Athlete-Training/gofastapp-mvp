/**
 * Write planned_workouts from workout-scope ingest when explicit segments were parsed.
 * Week ingest should materialize from catalogueWorkoutId instead.
 */

import { prisma } from "@/lib/prisma";
import type { PlanScheduleDay } from "@/lib/training/plan-schedule";
import {
  replacePrescribeSegmentsForAthlete,
  type PrescribeSegmentInput,
} from "@/lib/training/workout-or-planned-resolve";
import type { WorkoutStep } from "@/lib/training/prescription";

function stepsToPrescribeInput(steps: WorkoutStep[]): PrescribeSegmentInput[] {
  return steps.map((s, i) => ({
    stepOrder: s.stepOrder ?? i + 1,
    title: s.title,
    durationType: s.durationType === "TIME" ? "TIME" : "DISTANCE",
    durationValue: s.durationValue,
    targets: (s.targets ?? null) as PrescribeSegmentInput["targets"],
    repeatCount: s.repeatCount ?? null,
    notes: null,
    recoveryDurationType: s.recoveryDurationType ?? null,
    recoveryDurationValue: s.recoveryDurationValue ?? null,
  }));
}

export async function upsertPlannedWorkoutFromIngestDay(params: {
  athleteId: string;
  planId: string;
  day: PlanScheduleDay;
  title: string;
  segments: WorkoutStep[];
}): Promise<string> {
  if (!params.segments.length) {
    throw new Error(
      "Workout ingest requires parsed segments or a catalogue match — re-preview the week.",
    );
  }

  const existing = await prisma.planned_workouts.findFirst({
    where: {
      planId: params.planId,
      athleteId: params.athleteId,
      date: params.day.date,
    },
    select: { id: true },
  });

  let plannedWorkoutId: string;
  if (existing) {
    await prisma.planned_workouts.update({
      where: { id: existing.id },
      data: {
        title: params.title,
        workoutType: params.day.workoutType,
        estimatedDistanceInMeters: params.day.estimatedDistanceInMeters,
        catalogueWorkoutId: null,
        weekNumber: params.day.weekNumber,
        dayAssigned: params.day.dayAssigned,
        nOffset: params.day.nOffset,
        planCycleIndex: params.day.planCycleIndex,
        updatedAt: new Date(),
      },
    });
    plannedWorkoutId = existing.id;
  } else {
    const pw = await prisma.planned_workouts.create({
      data: {
        title: params.title,
        workoutType: params.day.workoutType,
        athleteId: params.athleteId,
        planId: params.planId,
        date: params.day.date,
        estimatedDistanceInMeters: params.day.estimatedDistanceInMeters,
        catalogueWorkoutId: null,
        weekNumber: params.day.weekNumber,
        dayAssigned: params.day.dayAssigned,
        nOffset: params.day.nOffset,
        planCycleIndex: params.day.planCycleIndex,
        updatedAt: new Date(),
      },
    });
    plannedWorkoutId = pw.id;
  }

  await replacePrescribeSegmentsForAthlete({
    id: plannedWorkoutId,
    athleteId: params.athleteId,
    normalized: stepsToPrescribeInput(params.segments),
  });

  return plannedWorkoutId;
}
