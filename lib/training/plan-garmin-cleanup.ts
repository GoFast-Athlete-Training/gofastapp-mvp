import { prisma } from "@/lib/prisma";
import { dateKeyToUtcNoonDate } from "@/lib/calendar-date";
import { productTodayKey } from "@/lib/plan-calendar-day";

export type PlanGarminCleanupResult = {
  clearedPushStamps: number;
};

const EMPTY: PlanGarminCleanupResult = {
  clearedPushStamps: 0,
};

/**
 * Clear stack push stamps on future plan days.
 * garminWorkoutId stays so the next send updates that watch workout.
 */
export async function cleanupFutureGarminSchedulesForPlan(params: {
  planId: string;
  athleteId: string;
}): Promise<PlanGarminCleanupResult> {
  const todayUtc = dateKeyToUtcNoonDate(productTodayKey());

  const result = await prisma.planned_workouts.updateMany({
    where: {
      planId: params.planId,
      athleteId: params.athleteId,
      date: { gte: todayUtc },
      workoutPushed: true,
    },
    data: {
      workoutPushed: false,
      workoutEditedAfterPush: false,
      updatedAt: new Date(),
    },
  });

  return { clearedPushStamps: result.count };
}
