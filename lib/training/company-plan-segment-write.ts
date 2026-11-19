import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  milesFromSegmentSteps,
  parseStaffSegmentWrite,
} from "@/lib/training/company-plan-segment-steps";
import { applyCatalogueDaySwap } from "@/lib/training/plan-schedule-day-edit";
import { dateForDayInWeek } from "@/lib/training/plan-schedule-dates";
import { utcDateOnly } from "@/lib/training/plan-utils";
import { planDayIsCompleted } from "@/lib/training/workout-has-actuals";
import { segmentSnapshotDocumentFromApiSegments } from "@/lib/training/workout-segment-snapshot";

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const METERS_PER_MILE = 1609.34;

export async function writeCompanyPlanDaySegments(params: {
  planId: string;
  weekNumber: number;
  dow: number;
  title: unknown;
  workoutType: unknown;
  steps: unknown;
}): Promise<{ ok: true; plannedWorkoutId: string } | { ok: false; error: string }> {
  if (!Number.isInteger(params.weekNumber) || params.weekNumber < 1) {
    return { ok: false, error: "weekNumber must be a positive integer" };
  }
  if (!Number.isInteger(params.dow) || params.dow < 1 || params.dow > 7) {
    return { ok: false, error: "dow must be 1–7" };
  }

  const parsed = parseStaffSegmentWrite({
    title: params.title,
    workoutType: params.workoutType,
    steps: params.steps,
  });
  if (!parsed.ok) return parsed;

  const plan = await prisma.training_plans.findUnique({
    where: { id: params.planId },
    select: { id: true, athleteId: true, startDate: true, planSchedule: true },
  });
  if (!plan) return { ok: false, error: "Plan not found" };

  const miles = milesFromSegmentSteps(parsed.steps);
  const applied = applyCatalogueDaySwap(plan.planSchedule, {
    weekNumber: params.weekNumber,
    dow: params.dow,
    workoutType: parsed.workoutType,
    miles,
    catalogueWorkoutId: null,
  });
  if (!applied.ok) return applied;

  const date = dateForDayInWeek(plan.startDate, params.weekNumber, params.dow);
  const dateKey = utcDateOnly(date).toISOString().slice(0, 10);
  const dayStart = utcDateOnly(date);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const existing = await prisma.planned_workouts.findFirst({
    where: {
      planId: plan.id,
      athleteId: plan.athleteId,
      date: { gte: dayStart, lte: dayEnd },
    },
    select: {
      id: true,
      workoutCompleted: true,
      workoutPushed: true,
      spawned_instances: {
        select: { actualDistanceMeters: true, actualDurationSeconds: true },
      },
    },
  });

  if (
    existing &&
    (existing.workoutCompleted || existing.spawned_instances.some((row) => planDayIsCompleted(row)))
  ) {
    return { ok: false, error: "This day is already logged. It was not changed." };
  }

  const segmentRows = parsed.steps.map((step) => ({
    stepOrder: step.stepOrder,
    title: step.title,
    durationType: step.durationType,
    durationValue: step.durationValue,
    targets: (step.targets ?? undefined) as Prisma.InputJsonValue | undefined,
    repeatCount: step.repeatCount ?? undefined,
    recoveryDurationType: step.recoveryDurationType ?? undefined,
    recoveryDurationValue: step.recoveryDurationValue ?? undefined,
    paceTargetEncodingVersion: 2,
    updatedAt: new Date(),
  }));
  const snapshot = segmentSnapshotDocumentFromApiSegments(parsed.steps, "segments_put");
  const estimatedDistanceInMeters = Math.round(miles * METERS_PER_MILE);
  const now = new Date();

  const plannedWorkoutId = await prisma.$transaction(async (tx) => {
    await tx.training_plans.update({
      where: { id: plan.id },
      data: {
        planSchedule: applied.next as unknown as Prisma.InputJsonValue,
        updatedAt: now,
      },
    });

    if (existing) {
      await tx.planned_workout_segments.deleteMany({ where: { plannedWorkoutId: existing.id } });
      await tx.planned_workouts.update({
        where: { id: existing.id },
        data: {
          title: parsed.title,
          workoutType: parsed.workoutType,
          catalogueWorkoutId: null,
          estimatedDistanceInMeters,
          weekNumber: params.weekNumber,
          dayAssigned: DAY_NAMES[params.dow - 1],
          planDay: dateKey,
          planCycleIndex: null,
          prescriptionNarrative: null,
          segmentSnapshotJson: snapshot,
          updatedAt: now,
          ...(existing.workoutPushed ? { workoutEditedAfterPush: true } : {}),
        },
      });
      await tx.planned_workout_segments.createMany({
        data: segmentRows.map((row) => ({ ...row, plannedWorkoutId: existing.id })),
      });
      return existing.id;
    }

    const created = await tx.planned_workouts.create({
      data: {
        title: parsed.title,
        workoutType: parsed.workoutType,
        athleteId: plan.athleteId,
        planId: plan.id,
        date,
        planDay: dateKey,
        estimatedDistanceInMeters,
        catalogueWorkoutId: null,
        weekNumber: params.weekNumber,
        dayAssigned: DAY_NAMES[params.dow - 1],
        planCycleIndex: null,
        segmentSnapshotJson: snapshot,
        updatedAt: now,
      },
    });
    await tx.planned_workout_segments.createMany({
      data: segmentRows.map((row) => ({ ...row, plannedWorkoutId: created.id })),
    });
    return created.id;
  });

  return { ok: true, plannedWorkoutId };
}
