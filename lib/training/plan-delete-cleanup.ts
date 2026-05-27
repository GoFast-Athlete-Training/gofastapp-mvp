import { prisma } from "@/lib/prisma";
import { utcDateOnly } from "@/lib/training/plan-utils";

/**
 * Hard-delete a plan's future uncompleted workouts (and segments). Completed workouts
 * are detached (planId cleared) so activity history survives.
 */
export async function cleanupPlanWorkoutsBeforeDelete(params: {
  planId: string;
  athleteId: string;
}): Promise<{ deletedFutureWorkouts: number; detachedCompletedWorkouts: number }> {
  const todayUtc = utcDateOnly(new Date());
  const workouts = await prisma.workouts.findMany({
    where: { planId: params.planId, athleteId: params.athleteId },
    select: { id: true, matchedActivityId: true, date: true },
  });

  const futureUncompleted = workouts.filter(
    (w) => w.matchedActivityId == null && w.date != null && w.date >= todayUtc
  );
  const completedOrPast = workouts.filter(
    (w) => w.matchedActivityId != null || w.date == null || w.date < todayUtc
  );

  await prisma.$transaction(async (tx) => {
    if (futureUncompleted.length > 0) {
      const ids = futureUncompleted.map((w) => w.id);
      await tx.workout_segments.deleteMany({ where: { workoutId: { in: ids } } });
      await tx.workouts.deleteMany({ where: { id: { in: ids } } });
    }
    if (completedOrPast.length > 0) {
      await tx.workouts.updateMany({
        where: { id: { in: completedOrPast.map((w) => w.id) } },
        data: { planId: null, updatedAt: new Date() },
      });
    }
  });

  return {
    deletedFutureWorkouts: futureUncompleted.length,
    detachedCompletedWorkouts: completedOrPast.length,
  };
}
