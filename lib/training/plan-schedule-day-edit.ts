import { Prisma, type WorkoutType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  catalogueWarmupWorkCooldownMiles,
  estimateCatalogueWorkoutMiles,
} from "@/lib/training/catalogue-mile-estimate";
import { parseWorkoutType } from "@/lib/training/catalogue-row";
import { cleanupFuturePlanWorkoutsAfterRegenerate } from "@/lib/training/plan-regenerate-cleanup";
import { dateForDayInWeek } from "@/lib/training/plan-schedule-dates";
import {
  isStructuredPlanWeek,
  type PlanDaySchedule,
} from "@/lib/training/plan-schedule-schema";
import { utcDateOnly } from "@/lib/training/plan-utils";
import { planDayIsCompleted } from "@/lib/training/workout-has-actuals";
import {
  MaterializeWorkoutError,
  materializeWorkoutForPlanDay,
} from "@/lib/training/workout-materializer";

export async function editPlanScheduleRun(params: {
  planId: string;
  athleteId: string;
  weekNumber: number;
  dow: number;
  miles?: number;
  remove?: boolean;
  /** Staff catalogue row. When set, this day is swapped (or inserted) and only that date is rematerialized. */
  catalogueWorkoutId?: string;
  workoutType?: string;
}): Promise<
  | { ok: true; planSchedule: unknown[]; plannedWorkoutId?: string }
  | { ok: false; error: string }
> {
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

  const catalogueWorkoutId = params.catalogueWorkoutId?.trim() ?? "";
  if (catalogueWorkoutId && !params.remove) {
    return swapPlanScheduleCatalogueDay({
      planId: params.planId,
      athleteId: params.athleteId,
      weekNumber: params.weekNumber,
      dow: params.dow,
      miles: params.miles,
      catalogueWorkoutId,
      workoutType: params.workoutType,
    });
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

export function applyCatalogueDaySwap(
  planSchedule: unknown,
  params: {
    weekNumber: number;
    dow: number;
    workoutType: WorkoutType;
    miles: number;
    catalogueWorkoutId: string;
  },
): { ok: true; next: unknown[] } | { ok: false; error: string } {
  if (!Array.isArray(planSchedule)) {
    return { ok: false, error: "This plan has no schedule to edit" };
  }

  let foundWeek = false;
  const next: unknown[] = [];
  for (const week of planSchedule) {
    if (!isStructuredPlanWeek(week) || week.weekNumber !== params.weekNumber) {
      next.push(week);
      continue;
    }
    foundWeek = true;
    const existing = week.days.find((day) => day.dow === params.dow) ?? null;
    const swapped = catalogueSwappedDay(existing, params);
    const days = existing
      ? week.days.map((day) => (day.dow === params.dow ? swapped : day))
      : [...week.days, swapped].sort((a, b) => a.dow - b.dow);
    next.push({ ...week, days });
  }

  if (!foundWeek) return { ok: false, error: "Week not found on this plan" };
  return { ok: true, next };
}

function catalogueSwappedDay(
  existing: PlanDaySchedule | null,
  params: {
    dow: number;
    workoutType: WorkoutType;
    miles: number;
    catalogueWorkoutId: string;
  },
): PlanDaySchedule {
  return {
    ...(existing ?? {
      dow: params.dow,
      workoutType: params.workoutType,
      miles: params.miles,
      catalogueWorkoutId: params.catalogueWorkoutId,
      planCycleIndex: null,
    }),
    dow: params.dow,
    workoutType: params.workoutType,
    miles: params.miles,
    catalogueWorkoutId: params.catalogueWorkoutId,
    planCycleIndex: null,
    workoutId: null,
    raceRegistryId: null,
    athleteRaceId: null,
    planRaceEventRole: null,
    raceName: null,
    replacedWorkoutType: null,
    recoveryAfterRace: false,
  };
}

function roundMiles(miles: number): number {
  return Math.round(miles * 10) / 10;
}

async function swapPlanScheduleCatalogueDay(params: {
  planId: string;
  athleteId: string;
  weekNumber: number;
  dow: number;
  miles?: number;
  catalogueWorkoutId: string;
  workoutType?: string;
}): Promise<
  | { ok: true; planSchedule: unknown[]; plannedWorkoutId?: string }
  | { ok: false; error: string }
> {
  const requestedType = params.workoutType != null ? parseWorkoutType(params.workoutType) : null;
  if (params.workoutType != null && params.workoutType.trim() !== "" && !requestedType) {
    return { ok: false, error: "workoutType must be Easy, Tempo, Intervals, LongRun, or Race" };
  }

  const [plan, catalogue, athlete] = await Promise.all([
    prisma.training_plans.findFirst({
      where: { id: params.planId, athleteId: params.athleteId },
      select: { id: true, startDate: true, planSchedule: true },
    }),
    prisma.workout_catalogue.findFirst({
      where: { id: params.catalogueWorkoutId, ownerAthleteId: null },
      select: {
        id: true,
        workoutType: true,
        segmentPaceDist: true,
        warmupMiles: true,
        cooldownMiles: true,
        workBaseMiles: true,
        workBaseReps: true,
        workBaseRepMeters: true,
      },
    }),
    prisma.athlete.findUnique({
      where: { id: params.athleteId },
      select: { fiveKPace: true },
    }),
  ]);

  if (!plan) return { ok: false, error: "Plan not found" };
  if (!catalogue) return { ok: false, error: "Catalogue workout not found" };
  if (catalogue.workoutType === "Race") {
    return { ok: false, error: "Race days use the race builder" };
  }
  if (requestedType && requestedType !== catalogue.workoutType) {
    return { ok: false, error: "workoutType does not match the catalogue workout" };
  }
  if (!athlete?.fiveKPace?.trim()) {
    return {
      ok: false,
      error: "This athlete has no 5K pace, so the workout cannot be prescribed.",
    };
  }

  const estimated =
    catalogueWarmupWorkCooldownMiles(catalogue) ??
    estimateCatalogueWorkoutMiles(catalogue, catalogue.workoutType === "Easy" ? "Easy" : catalogue.workoutType === "Tempo" ? "Tempo" : "Intervals");
  const miles = roundMiles(params.miles != null ? params.miles : estimated);
  if (!Number.isFinite(miles) || miles < 0 || miles > 100) {
    return { ok: false, error: "miles must be between 0 and 100" };
  }

  const applied = applyCatalogueDaySwap(plan.planSchedule, {
    weekNumber: params.weekNumber,
    dow: params.dow,
    workoutType: catalogue.workoutType,
    miles,
    catalogueWorkoutId: catalogue.id,
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
      athleteId: params.athleteId,
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
    (existing.workoutCompleted ||
      existing.spawned_instances.some((row) => planDayIsCompleted(row)))
  ) {
    return { ok: false, error: "This day is already logged. It was not swapped." };
  }

  const previous = plan.planSchedule as Prisma.InputJsonValue;
  await prisma.training_plans.update({
    where: { id: plan.id },
    data: {
      planSchedule: applied.next as unknown as Prisma.InputJsonValue,
      updatedAt: new Date(),
    },
  });

  try {
    const materialized = await materializeWorkoutForPlanDay({
      planId: plan.id,
      athleteId: params.athleteId,
      dateParam: dateKey,
      forceRematerialize: true,
    });
    return {
      ok: true,
      planSchedule: applied.next,
      plannedWorkoutId: materialized.plannedWorkoutId,
    };
  } catch (error) {
    await prisma.training_plans.update({
      where: { id: plan.id },
      data: { planSchedule: previous, updatedAt: new Date() },
    });
    const message =
      error instanceof MaterializeWorkoutError
        ? error.message
        : "Could not prescribe this day";
    return { ok: false, error: message };
  }
}
