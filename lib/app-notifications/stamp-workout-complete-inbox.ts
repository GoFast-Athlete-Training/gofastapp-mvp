import { prisma } from '@/lib/prisma';

/** Stamp workout.complete for in-app inbox; idempotent on first send. */
export async function stampWorkoutCompleteInbox(workoutId: string): Promise<boolean> {
  const result = await prisma.workouts.updateMany({
    where: {
      id: workoutId,
      appnotificationCompleteSentAt: null,
    },
    data: { appnotificationCompleteSentAt: new Date() },
  });
  return result.count > 0;
}
