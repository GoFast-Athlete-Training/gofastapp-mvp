import { prisma } from "@/lib/prisma";
import { sendAppNotification } from "@/lib/app-notifications/send";
import { stampWorkoutCompleteInbox } from "@/lib/app-notifications/stamp-workout-complete-inbox";
import { seedSpawnedWorkoutFromActivity } from "./seed-spawned-workout-from-activity";

/** Congrats surfacing push — always opens /workouts/{id}, never /activities/{id}. */
export async function sendFinishWorkoutSurfacingPush(params: {
  athleteId: string;
  workoutId: string;
  workoutTitle?: string | null;
}): Promise<void> {
  const title =
    params.workoutTitle?.trim() ||
    (
      await prisma.workouts.findUnique({
        where: { id: params.workoutId },
        select: { title: true },
      })
    )?.title;

  try {
    await sendAppNotification({
      athleteId: params.athleteId,
      templateKey: "workout.complete",
      objectType: "workout",
      objectId: params.workoutId,
      deeplink: `/workouts/${params.workoutId}`,
      payload: {
        workoutId: params.workoutId,
        type: "workout_complete",
        screen: "workout",
        objectType: "workout",
        objectId: params.workoutId,
      },
      facts: { workoutTitle: title ?? "Workout" },
    });
  } catch (err) {
    console.error("finish_workout_surfacing push:", err);
  }

  await stampWorkoutCompleteInbox(params.workoutId);
}

/**
 * Resolve or seed a spawned workout for a finished run and send surfacing push when
 * applyActivityToWorkout did not already notify (unmatched / forced seed).
 */
export async function surfaceFinishedRunningActivity(params: {
  activityId: string;
  athleteId: string;
  /** When true, applyActivityToWorkout already sent workout.complete. */
  matchApplied?: boolean;
}): Promise<{ workoutId: string | null; pushSent: boolean }> {
  if (params.matchApplied) {
    const linked = await prisma.workouts.findFirst({
      where: { garminDetailActivityId: params.activityId },
      select: { id: true },
    });
    return { workoutId: linked?.id ?? null, pushSent: false };
  }

  let workoutId: string | null = null;

  const linked = await prisma.workouts.findFirst({
    where: { garminDetailActivityId: params.activityId },
    select: { id: true, title: true },
  });
  if (linked) {
    workoutId = linked.id;
    await sendFinishWorkoutSurfacingPush({
      athleteId: params.athleteId,
      workoutId: linked.id,
      workoutTitle: linked.title,
    });
    return { workoutId, pushSent: true };
  }

  const seeded = await seedSpawnedWorkoutFromActivity(params.activityId);
  if (seeded.workoutId) {
    workoutId = seeded.workoutId;
    await sendFinishWorkoutSurfacingPush({
      athleteId: params.athleteId,
      workoutId: seeded.workoutId,
    });
    return { workoutId, pushSent: true };
  }

  return { workoutId: null, pushSent: false };
}
