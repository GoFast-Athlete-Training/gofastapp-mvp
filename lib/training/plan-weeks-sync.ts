/**
 * Sync a materialized workout row's changes back into the planWeeks JSON string.
 *
 * planWeeks is the source of truth for pre-materialized days. When a workout row
 * is edited after materialization, this function patches the corresponding token
 * in planWeeks so the two stay consistent.
 *
 * Only touches the specific slot (weekNumber + dayAssigned). Other tokens are unchanged.
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  dayNameToAbbr,
  formatMilesForScheduleToken,
  workoutTypeToScheduleSuffix,
} from "@/lib/training/schedule-parser";

type PlanWeekSlot = { weekNumber: number; schedule: string };

export async function syncWorkoutToPlanWeeks(workoutId: string): Promise<void> {
  const workout = await prisma.workouts.findUnique({
    where: { id: workoutId },
    select: {
      planId: true,
      weekNumber: true,
      dayAssigned: true,
      workoutType: true,
      estimatedDistanceInMeters: true,
      planLadderIndex: true,
    },
  });

  if (
    !workout?.planId ||
    workout.weekNumber == null ||
    !workout.dayAssigned ||
    !workout.workoutType ||
    workout.estimatedDistanceInMeters == null
  ) {
    return;
  }

  const plan = await prisma.training_plans.findUnique({
    where: { id: workout.planId },
    select: { planWeeks: true },
  });

  if (!plan?.planWeeks || !Array.isArray(plan.planWeeks)) return;

  const planWeeks = plan.planWeeks as PlanWeekSlot[];
  const weekEntry = planWeeks.find((w) => w.weekNumber === workout.weekNumber);
  if (!weekEntry) return;

  const dayAbbr = dayNameToAbbr(workout.dayAssigned);
  const miles = workout.estimatedDistanceInMeters / 1609.34;
  const milesStr = formatMilesForScheduleToken(miles);
  const suffix = workoutTypeToScheduleSuffix(workout.workoutType);

  let newToken = `${dayAbbr}:${milesStr}${suffix}`;
  if (workout.planLadderIndex != null) {
    newToken += `-i${workout.planLadderIndex}`;
  }

  const tokens = weekEntry.schedule.split(" ");
  const updated = tokens.map((t) => {
    const colonIdx = t.indexOf(":");
    if (colonIdx === -1) return t;
    const tokenDay = t.slice(0, colonIdx);
    return tokenDay === dayAbbr ? newToken : t;
  });

  weekEntry.schedule = updated.join(" ");

  await prisma.training_plans.update({
    where: { id: workout.planId },
    data: {
      planWeeks: planWeeks as unknown as Prisma.InputJsonValue,
      updatedAt: new Date(),
    },
  });
}
