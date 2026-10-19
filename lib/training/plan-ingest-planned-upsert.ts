/**
 * Write planned_workouts from week ingest (no catalogue prescription).
 */

import { prisma } from "@/lib/prisma";
import type { PlanScheduleDay } from "@/lib/training/plan-schedule";
import {
  replacePrescribeSegmentsForAthlete,
  type PrescribeSegmentInput,
} from "@/lib/training/workout-or-planned-resolve";
import type { WorkoutStep } from "@/lib/training/prescription";
import { WorkoutType } from "@prisma/client";

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

function fallbackStepsForDay(day: PlanScheduleDay, title: string): WorkoutStep[] {
  const miles = day.estimatedDistanceInMeters / 1609.34;
  const mi = Math.max(0.1, Math.round(miles * 10) / 10);
  const stepTitle =
    day.workoutType === WorkoutType.Easy
      ? "Easy"
      : day.workoutType === WorkoutType.Tempo
        ? "Tempo"
        : day.workoutType === WorkoutType.Intervals
          ? "Intervals"
          : title || "Run";
  return [
    {
      stepOrder: 1,
      title: stepTitle,
      durationType: "DISTANCE",
      durationValue: mi,
      targets: null,
    },
  ];
}

export async function upsertPlannedWorkoutFromIngestDay(params: {
  athleteId: string;
  planId: string;
  day: PlanScheduleDay;
  title: string;
  segments?: WorkoutStep[] | null;
}): Promise<string> {
  const steps =
    params.segments && params.segments.length > 0
      ? params.segments
      : fallbackStepsForDay(params.day, params.title);

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
    normalized: stepsToPrescribeInput(steps),
  });

  return plannedWorkoutId;
}
