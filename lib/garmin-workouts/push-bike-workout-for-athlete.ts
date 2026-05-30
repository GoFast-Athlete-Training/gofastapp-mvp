import { prisma } from "@/lib/prisma";
import { assembleGarminBikeWorkout } from "@/lib/garmin-workouts/assemble-garmin-bike-workout";
import {
  GarminApiError,
  createGarminTrainingApiForAthlete,
} from "@/lib/garmin-workouts/garmin-training-api";
import {
  deleteGarminScheduleIfPresent,
  scheduleAndVerifyWorkout,
  scheduleFailureToGarminApiResult,
} from "@/lib/garmin-workouts/garmin-schedule-service";
import { GarminNotConnectedError, requireGarminTokenFresh } from "@/lib/domain-garmin";
import { ymdFromDate } from "@/lib/training/plan-utils";

export type PushBikeWorkoutForAthleteResult =
  | {
      ok: true;
      garminWorkoutId: number;
      garminScheduleId: number;
      scheduledDate: string;
    }
  | {
      ok: false;
      code:
        | "not_found"
        | "no_steps"
        | "garmin_disconnected"
        | "garmin_api"
        | "assemble"
        | "other";
      message: string;
      garminStatus?: number;
    };

function utcTodayYmd(): string {
  return ymdFromDate(new Date());
}

/**
 * Push bike_workout to Garmin Training API (CYCLING). Schedules on workout.date or today.
 */
export async function pushBikeWorkoutToGarminForAthlete(
  athleteId: string,
  bikeWorkoutId: string,
  scheduleDateYmdOverride?: string
): Promise<PushBikeWorkoutForAthleteResult> {
  try {
    const workout = await prisma.bike_workout.findFirst({
      where: { id: bikeWorkoutId, athleteId },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });

    if (!workout) {
      return { ok: false, code: "not_found", message: "Bike workout not found" };
    }

    if (!workout.steps?.length) {
      return { ok: false, code: "no_steps", message: "Bike workout has no steps" };
    }

    const scheduledDate =
      scheduleDateYmdOverride?.trim() ||
      (workout.date ? ymdFromDate(workout.date) : utcTodayYmd());

    let garminWorkout;
    try {
      garminWorkout = assembleGarminBikeWorkout(workout);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Invalid bike workout for Garmin";
      return { ok: false, code: "assemble", message };
    }

    const token = await requireGarminTokenFresh(athleteId);
    const client = createGarminTrainingApiForAthlete(athleteId, token);

    let garminWorkoutId = workout.garminWorkoutId;
    if (garminWorkoutId != null) {
      try {
        await client.updateWorkout(garminWorkoutId, garminWorkout);
      } catch (e) {
        if (e instanceof GarminApiError && e.status === 404) {
          const result = await client.createWorkout(garminWorkout);
          garminWorkoutId = result.workoutId;
        } else {
          throw e;
        }
      }
    } else {
      const result = await client.createWorkout(garminWorkout);
      garminWorkoutId = result.workoutId;
    }

    const deleteResult = await deleteGarminScheduleIfPresent(
      client,
      workout.garminScheduleId
    );
    if (deleteResult.wasStaleOnGarmin) {
      await prisma.bike_workout.update({
        where: { id: workout.id },
        data: { garminScheduleId: null },
      });
    }

    const scheduleResult = await scheduleAndVerifyWorkout(client, {
      garminWorkoutId,
      scheduledDate,
    });
    if (!scheduleResult.ok) {
      const fail = scheduleFailureToGarminApiResult(scheduleResult);
      return {
        ok: false,
        code: fail.code,
        message: fail.message,
        garminStatus: fail.garminStatus,
      };
    }
    const garminScheduleId = scheduleResult.garminScheduleId;

    await prisma.bike_workout.update({
      where: { id: workout.id },
      data: { garminWorkoutId, garminScheduleId },
    });

    return { ok: true, garminWorkoutId, garminScheduleId, scheduledDate };
  } catch (error: unknown) {
    if (error instanceof GarminNotConnectedError) {
      return { ok: false, code: "garmin_disconnected", message: error.message };
    }
    if (error instanceof GarminApiError) {
      return {
        ok: false,
        code: "garmin_api",
        message: error.details || "Garmin API error",
        garminStatus: error.status,
      };
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, code: "other", message };
  }
}
