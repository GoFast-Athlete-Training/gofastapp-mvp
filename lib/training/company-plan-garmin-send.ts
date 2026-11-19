import { prisma } from "@/lib/prisma";
import { pushWorkoutToGarminForAthlete } from "@/lib/garmin-workouts/push-workout-for-athlete";
import { dateForDayInWeek } from "@/lib/training/plan-schedule-dates";
import { utcDateOnly } from "@/lib/training/plan-utils";
import {
  MaterializeWorkoutError,
  materializeWorkoutForPlanDay,
} from "@/lib/training/workout-materializer";

export async function sendCompanyPlanDayToGarmin(params: {
  planId: string;
  weekNumber: number;
  dow: number;
}): Promise<
  | {
      ok: true;
      plannedWorkoutId: string;
      scheduledDate: string;
      garminWorkoutId: number | null;
      garminScheduleId: number | null;
      isUpdatedResend: boolean;
    }
  | { ok: false; error: string }
> {
  if (!Number.isInteger(params.weekNumber) || params.weekNumber < 1) {
    return { ok: false, error: "weekNumber must be a positive integer" };
  }
  if (!Number.isInteger(params.dow) || params.dow < 1 || params.dow > 7) {
    return { ok: false, error: "dow must be 1–7" };
  }

  const plan = await prisma.training_plans.findUnique({
    where: { id: params.planId },
    select: { id: true, athleteId: true, startDate: true },
  });
  if (!plan) return { ok: false, error: "Plan not found" };

  const dateKey = utcDateOnly(dateForDayInWeek(plan.startDate, params.weekNumber, params.dow))
    .toISOString()
    .slice(0, 10);

  let plannedWorkoutId: string;
  try {
    const materialized = await materializeWorkoutForPlanDay({
      planId: plan.id,
      athleteId: plan.athleteId,
      dateParam: dateKey,
    });
    plannedWorkoutId = materialized.plannedWorkoutId;
  } catch (error) {
    const message =
      error instanceof MaterializeWorkoutError ? error.message : "Could not prescribe this day";
    return { ok: false, error: message };
  }

  const pushed = await pushWorkoutToGarminForAthlete(plan.athleteId, plannedWorkoutId);
  if (!pushed.ok) return { ok: false, error: pushed.message };

  const stamped = await prisma.planned_workouts.findUnique({
    where: { id: plannedWorkoutId },
    select: { garminWorkoutId: true, garminScheduleId: true },
  });

  return {
    ok: true,
    plannedWorkoutId,
    scheduledDate: pushed.scheduledDate,
    garminWorkoutId: stamped?.garminWorkoutId ?? null,
    garminScheduleId: stamped?.garminScheduleId ?? null,
    isUpdatedResend: pushed.isUpdatedResend,
  };
}
