/**
 * Push a materialized workout's distance back into training_plans.planSchedule.
 * Supports structured `days[]` and legacy `{ schedule: string }` weeks.
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { PlanDaySchedule } from "@/lib/training/plan-schedule-schema";
import {
  dayNameToAbbr,
  dayNameToOurDow,
  formatMilesForScheduleToken,
  workoutTypeToScheduleSuffix,
} from "@/lib/training/schedule-parser";

type PlanWeekSlot = {
  weekNumber: number;
  schedule?: unknown;
  days?: unknown;
};

/** Sync estimated miles from workout row onto the persisted planSchedule JSON */
export async function syncWorkoutToPlanSchedule(workoutId: string): Promise<void> {
  const workout = await prisma.workouts.findUnique({
    where: { id: workoutId },
    select: {
      planId: true,
      weekNumber: true,
      dayAssigned: true,
      workoutType: true,
      estimatedDistanceInMeters: true,
      planCycleIndex: true,
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
    select: { planSchedule: true },
  });

  if (!plan?.planSchedule || !Array.isArray(plan.planSchedule)) return;

  const planSchedule = plan.planSchedule as PlanWeekSlot[];
  const weekEntry = planSchedule.find((w) => w.weekNumber === workout.weekNumber);
  if (!weekEntry) return;

  const daysRaw = weekEntry.days;
  const structured =
    Array.isArray(daysRaw) &&
    daysRaw.length > 0 &&
    typeof (daysRaw[0] as PlanDaySchedule).dow === "number";

  if (structured) {
    const dow = dayNameToOurDow(workout.dayAssigned.trim());
    const miles = Math.round((workout.estimatedDistanceInMeters / 1609.34) * 100) / 100;
    const daySlots = daysRaw as PlanDaySchedule[];
    for (let i = 0; i < daySlots.length; i++) {
      const slot = daySlots[i]!;
      if (slot?.dow === dow && slot.workoutType === workout.workoutType) {
        const patched = [...daySlots];
        patched[i] = {
          ...slot,
          miles,
          planCycleIndex:
            workout.planCycleIndex != null
              ? workout.planCycleIndex
              : slot.planCycleIndex,
        };
        weekEntry.days = patched;
      }
    }
    await prisma.training_plans.update({
      where: { id: workout.planId },
      data: {
        planSchedule: planSchedule as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });
    return;
  }

  /** Legacy compact string mirror */
  if (typeof weekEntry.schedule !== "string") return;

  const dayAbbr = dayNameToAbbr(workout.dayAssigned);
  const mi = workout.estimatedDistanceInMeters / 1609.34;
  const milesStr = formatMilesForScheduleToken(mi);
  const suffix = workoutTypeToScheduleSuffix(workout.workoutType);

  let newToken = `${dayAbbr}:${milesStr}${suffix}`;
  if (workout.planCycleIndex != null) {
    newToken += `-i${workout.planCycleIndex}`;
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
      planSchedule: planSchedule as unknown as Prisma.InputJsonValue,
      updatedAt: new Date(),
    },
  });
}
