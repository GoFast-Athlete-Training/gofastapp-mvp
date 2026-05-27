import { prisma } from "@/lib/prisma";
import { utcDateOnly } from "@/lib/training/plan-utils";

/**
 * After regenerating a plan schedule, remove future uncompleted workout rows so
 * lazy materialization rebuilds from the new planSchedule instead of stale rows.
 */
export async function cleanupFuturePlanWorkoutsAfterRegenerate(params: {
  planId: string;
  athleteId: string;
}): Promise<number> {
  const todayUtc = utcDateOnly(new Date());
  const workouts = await prisma.workouts.findMany({
    where: {
      planId: params.planId,
      athleteId: params.athleteId,
      matchedActivityId: null,
      date: { gte: todayUtc },
    },
    select: { id: true },
  });
  if (workouts.length === 0) return 0;

  const ids = workouts.map((w) => w.id);
  await prisma.$transaction(async (tx) => {
    await tx.workout_segments.deleteMany({ where: { workoutId: { in: ids } } });
    await tx.workouts.deleteMany({ where: { id: { in: ids } } });
  });
  return ids.length;
}
