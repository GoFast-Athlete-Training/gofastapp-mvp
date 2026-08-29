/**
 * One-shot cleanup: remove future unmatched workout rows for ARCHIVED/PARKED plans.
 * Past and matched rows are preserved.
 */

import { TrainingPlanLifecycle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  cleanupFutureWorkoutsForRetiredPlan,
  type RegenerateWorkoutCleanupResult,
} from "@/lib/training/plan-regenerate-cleanup";

export type RetiredPlanCleanupSummary = {
  plansProcessed: number;
  clearedFutureWorkouts: number;
  clearedFuturePlannedWorkouts: number;
  garminSchedulesDeleted: number;
  garminSchedulesStale: number;
  garminScheduleDeleteErrors: number;
  perPlan: Array<{
    planId: string;
    athleteId: string;
    lifecycleStatus: TrainingPlanLifecycle;
    result: RegenerateWorkoutCleanupResult;
  }>;
};

/**
 * Run cleanupFutureWorkoutsForRetiredPlan for every ARCHIVED/PARKED training plan.
 * Optional athleteId scopes to one athlete (e.g. your account after a bad alert).
 */
export async function cleanupAllRetiredPlansFutureWorkouts(params?: {
  athleteId?: string;
}): Promise<RetiredPlanCleanupSummary> {
  const retiredPlans = await prisma.training_plans.findMany({
    where: {
      lifecycleStatus: {
        in: [TrainingPlanLifecycle.ARCHIVED, TrainingPlanLifecycle.PARKED],
      },
      ...(params?.athleteId ? { athleteId: params.athleteId } : {}),
    },
    select: {
      id: true,
      athleteId: true,
      lifecycleStatus: true,
    },
    orderBy: [{ athleteId: "asc" }, { updatedAt: "desc" }],
  });

  const perPlan: RetiredPlanCleanupSummary["perPlan"] = [];
  let clearedFutureWorkouts = 0;
  let clearedFuturePlannedWorkouts = 0;
  let garminSchedulesDeleted = 0;
  let garminSchedulesStale = 0;
  let garminScheduleDeleteErrors = 0;

  for (const plan of retiredPlans) {
    const result = await cleanupFutureWorkoutsForRetiredPlan({
      planId: plan.id,
      athleteId: plan.athleteId,
    });
    perPlan.push({
      planId: plan.id,
      athleteId: plan.athleteId,
      lifecycleStatus: plan.lifecycleStatus,
      result,
    });
    clearedFutureWorkouts += result.clearedFutureWorkouts;
    clearedFuturePlannedWorkouts += result.clearedFuturePlannedWorkouts;
    garminSchedulesDeleted += result.garminSchedulesDeleted;
    garminSchedulesStale += result.garminSchedulesStale;
    garminScheduleDeleteErrors += result.garminScheduleDeleteErrors;
  }

  return {
    plansProcessed: retiredPlans.length,
    clearedFutureWorkouts,
    clearedFuturePlannedWorkouts,
    garminSchedulesDeleted,
    garminSchedulesStale,
    garminScheduleDeleteErrors,
    perPlan,
  };
}

export function formatRetiredPlanCleanupSummary(
  summary: RetiredPlanCleanupSummary
): string {
  const lines = [
    `Retired plan future-workout cleanup`,
    `  plans processed: ${summary.plansProcessed}`,
    `  cleared future workouts: ${summary.clearedFutureWorkouts}`,
    `  cleared future planned_workouts: ${summary.clearedFuturePlannedWorkouts}`,
    `  garmin schedules deleted: ${summary.garminSchedulesDeleted}`,
    `  garmin schedules stale: ${summary.garminSchedulesStale}`,
    `  garmin schedule delete errors: ${summary.garminScheduleDeleteErrors}`,
  ];

  const touched = summary.perPlan.filter(
    (p) =>
      p.result.clearedFutureWorkouts > 0 ||
      p.result.clearedFuturePlannedWorkouts > 0
  );
  if (touched.length > 0) {
    lines.push("", "Plans with cleared rows:");
    for (const p of touched) {
      lines.push(
        `  ${p.planId} (${p.lifecycleStatus}) athlete=${p.athleteId} workouts=${p.result.clearedFutureWorkouts} planned=${p.result.clearedFuturePlannedWorkouts}`
      );
    }
  }

  return lines.join("\n");
}
