/**
 * stampPaceDeltas — one job after splits exist on a workout.
 * Reads planned pace bands + workout_segment_laps, writes paceDeltaSecPerMile.
 * Not credits. Not analyze (adaptive) — that is a later lane.
 */

import { prisma } from "@/lib/prisma";
import {
  analyzeWorkoutPaceDeltas,
  type AnalyzeWorkoutPaceResult,
} from "./workout-pace-analyzer";

export type StampPaceDeltasResult =
  | AnalyzeWorkoutPaceResult
  | { ok: false; code: "NO_WORKOUT" | "NO_ACTIVITY"; message: string };

export async function stampPaceDeltas(params: {
  workoutId: string;
  activityId?: string;
}): Promise<StampPaceDeltasResult> {
  const workout = await prisma.workouts.findUnique({
    where: { id: params.workoutId },
    select: { id: true, garminDetailActivityId: true, splitsStamped: true },
  });

  if (!workout) {
    return { ok: false, code: "NO_WORKOUT", message: "Workout not found." };
  }

  const activityId = params.activityId ?? workout.garminDetailActivityId;
  if (!activityId) {
    return {
      ok: false,
      code: "NO_ACTIVITY",
      message: "Workout has no linked Garmin activity.",
    };
  }

  return analyzeWorkoutPaceDeltas({ workoutId: params.workoutId, activityId });
}

/** Fire-and-forget wrapper for ingest after splits are stamped. */
export async function stampPaceDeltasAfterSplits(params: {
  workoutId: string;
  activityId: string;
}): Promise<StampPaceDeltasResult> {
  try {
    const result = await stampPaceDeltas(params);
    if (!result.ok) {
      console.warn("[stampPaceDeltas]", params.workoutId, result);
    } else {
      console.log("[stampPaceDeltas]", params.workoutId, result);
    }
    return result;
  } catch (error: unknown) {
    console.warn("[stampPaceDeltas] failed", params.workoutId, error);
    return {
      ok: false,
      code: "NO_WORKOUT",
      message: error instanceof Error ? error.message : "stampPaceDeltas failed",
    };
  }
}

export async function stampPaceDeltasForLinkedActivity(
  activityId: string
): Promise<StampPaceDeltasResult> {
  const workout = await prisma.workouts.findFirst({
    where: { garminDetailActivityId: activityId },
    select: { id: true },
  });
  if (!workout) {
    return {
      ok: false,
      code: "NO_WORKOUT",
      message: "No workout linked to this activity.",
    };
  }
  return stampPaceDeltasAfterSplits({ workoutId: workout.id, activityId });
}
