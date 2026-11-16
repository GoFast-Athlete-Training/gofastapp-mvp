import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cleanupFuturePlanWorkoutsAfterRegenerate } from "@/lib/training/plan-regenerate-cleanup";
import { isStructuredPlanWeek } from "@/lib/training/plan-schedule-schema";

export async function editPlanScheduleRun(params: {
  planId: string;
  athleteId: string;
  weekNumber: number;
  dow: number;
  miles?: number;
  remove?: boolean;
}): Promise<{ ok: true; planSchedule: unknown[] } | { ok: false; error: string }> {
  if (!Number.isInteger(params.weekNumber) || params.weekNumber < 1) {
    return { ok: false, error: "weekNumber must be a positive integer" };
  }
  if (!Number.isInteger(params.dow) || params.dow < 1 || params.dow > 7) {
    return { ok: false, error: "dow must be 1–7" };
  }
  if (
    params.miles != null &&
    (!Number.isFinite(params.miles) || params.miles < 0 || params.miles > 100)
  ) {
    return { ok: false, error: "miles must be between 0 and 100" };
  }

  const plan = await prisma.training_plans.findFirst({
    where: { id: params.planId, athleteId: params.athleteId },
    select: { id: true, planSchedule: true },
  });
  if (!plan) return { ok: false, error: "Plan not found" };
  if (!Array.isArray(plan.planSchedule)) {
    return { ok: false, error: "This plan has no schedule to edit" };
  }

  let found = false;
  const next: unknown[] = [];
  for (const week of plan.planSchedule) {
    if (!isStructuredPlanWeek(week) || week.weekNumber !== params.weekNumber) {
      next.push(week);
      continue;
    }
    const hadDay = week.days.some((day) => day.dow === params.dow);
    if (!hadDay) {
      next.push(week);
      continue;
    }
    found = true;
    const days = params.remove
      ? week.days.filter((day) => day.dow !== params.dow)
      : week.days.map((day) =>
          day.dow === params.dow && params.miles != null
            ? { ...day, miles: params.miles }
            : day,
        );
    next.push({ ...week, days });
  }

  if (!found) return { ok: false, error: "Run not found on that week" };

  await prisma.training_plans.update({
    where: { id: plan.id },
    data: {
      planSchedule: next as unknown as Prisma.InputJsonValue,
      updatedAt: new Date(),
    },
  });
  await cleanupFuturePlanWorkoutsAfterRegenerate({
    planId: plan.id,
    athleteId: params.athleteId,
  });

  return { ok: true, planSchedule: next };
}
