/**
 * Resolve (find-or-create) today's plan workout in `workouts` before Garmin auto-push.
 * Same logic as GET /api/training/workout/day — cron must materialize first.
 */

import { TrainingPlanLifecycle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { planScheduleDayForDateKey } from "./plan-schedule";
import { metersToMiles } from "@/lib/pace-utils";
import { ymdFromDate } from "./plan-utils";
import { materializeWorkoutForPlanDay } from "./workout-materializer";

export type MaterializeTodayPlanResult =
  | { status: "materialized"; workoutId: string }
  | { status: "no_session_today" }
  | { status: "no_active_plan" }
  | { status: "error"; message: string };

/**
 * Find-or-create the active plan's workout row for the given UTC calendar day (default: today).
 */
export async function materializeTodayPlanWorkoutForAthlete(
  athleteId: string,
  dateYmd?: string
): Promise<MaterializeTodayPlanResult> {
  const dateParam = dateYmd?.trim() || ymdFromDate(new Date());

  const plan = await prisma.training_plans.findFirst({
    where: {
      athleteId,
      lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
    },
    include: {
      race_registry: {
        select: {
          raceDate: true,
          name: true,
          distanceMeters: true,
        },
      },
    },
  });

  if (!plan) {
    return { status: "no_active_plan" };
  }

  const rawSchedule = plan.planSchedule;
  if (!Array.isArray(rawSchedule) || rawSchedule.length === 0) {
    return { status: "no_active_plan" };
  }

  const race = plan.race_registry;
  const raceDistanceMiles =
    race?.distanceMeters != null && Number.isFinite(Number(race.distanceMeters))
      ? metersToMiles(Number(race.distanceMeters))
      : null;

  const scheduled = planScheduleDayForDateKey({
    planStartDate: plan.startDate,
    planSchedule: rawSchedule,
    raceDate: race?.raceDate ?? null,
    raceName: race?.name ?? null,
    raceDistanceMiles,
    dateKey: dateParam,
    maxWeekNumber: plan.totalWeeks,
    catalogueTitleById: {},
  });

  if (!scheduled) {
    return { status: "no_session_today" };
  }

  try {
    const { workoutId } = await materializeWorkoutForPlanDay({
      planId: plan.id,
      athleteId,
      dateParam,
    });
    return { status: "materialized", workoutId };
  } catch (e) {
    const message = e instanceof Error ? e.message : "materialize failed";
    return { status: "error", message };
  }
}
