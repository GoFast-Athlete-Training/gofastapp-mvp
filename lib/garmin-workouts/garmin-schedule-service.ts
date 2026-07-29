/**
 * Garmin Training API calendar schedule lifecycle.
 *
 * Workout CRUD (garminWorkoutId) and schedule are separate:
 * - POST /workout -> library definition (our universal key)
 * - POST /schedule { workoutId, date } -> calendar placement
 */

import { GarminApiError } from "./garmin-training-api";

export type GarminScheduleClient = {
  scheduleWorkout(
    workoutId: number,
    date: string
  ): Promise<{ scheduleId: number }>;
  getSchedule(
    scheduleId: number
  ): Promise<{ workoutId: number; date?: string; scheduleId?: number }>;
  deleteSchedule(scheduleId: number): Promise<void>;
};

export type ScheduleWorkoutSuccess = {
  ok: true;
};

export type ScheduleWorkoutFailure = {
  ok: false;
  message: string;
  garminStatus?: number;
};

export type ScheduleWorkoutResult = ScheduleWorkoutSuccess | ScheduleWorkoutFailure;

export type DeleteScheduleResult = {
  /** True when Garmin returned 404 — local schedule id was already stale. */
  wasStaleOnGarmin: boolean;
};

/**
 * Delete an existing calendar schedule before re-scheduling.
 * 404 means the schedule id is stale; caller should clear local garminScheduleId.
 */
export async function deleteGarminScheduleIfPresent(
  client: GarminScheduleClient,
  garminScheduleId: number | null | undefined
): Promise<DeleteScheduleResult> {
  if (garminScheduleId == null) {
    return { wasStaleOnGarmin: false };
  }
  try {
    await client.deleteSchedule(garminScheduleId);
    return { wasStaleOnGarmin: false };
  } catch (e) {
    if (e instanceof GarminApiError && e.status === 404) {
      return { wasStaleOnGarmin: true };
    }
    throw e;
  }
}

/**
 * POST /schedule — attach garminWorkoutId to a calendar date. No GET verify.
 */
export async function scheduleWorkoutOnCalendar(
  client: GarminScheduleClient,
  params: { garminWorkoutId: number; scheduledDate: string }
): Promise<ScheduleWorkoutResult> {
  try {
    await client.scheduleWorkout(params.garminWorkoutId, params.scheduledDate);
    return { ok: true };
  } catch (e) {
    const message =
      e instanceof GarminApiError
        ? e.details || "Could not create Garmin calendar schedule"
        : e instanceof Error
          ? e.message
          : "Could not create Garmin calendar schedule";
    return {
      ok: false,
      message,
      garminStatus: e instanceof GarminApiError ? e.status : undefined,
    };
  }
}

export function scheduleFailureToGarminApiResult(failure: ScheduleWorkoutFailure): {
  code: "garmin_api";
  message: string;
  garminStatus?: number;
} {
  return {
    code: "garmin_api",
    message: failure.message.startsWith("Garmin")
      ? failure.message
      : `Garmin calendar schedule failed: ${failure.message}`,
    garminStatus: failure.garminStatus,
  };
}

/** @deprecated Use scheduleWorkoutOnCalendar — verify GET removed (wrong scheduleId field broke pushes). */
export type ScheduleAndVerifyFailure = ScheduleWorkoutFailure & { phase?: "create" | "verify" };

/** @deprecated */
export async function scheduleAndVerifyWorkout(
  client: GarminScheduleClient,
  params: { garminWorkoutId: number; scheduledDate: string }
): Promise<
  | { ok: true; garminScheduleId: number }
  | { ok: false; phase: "create" | "verify"; message: string; garminStatus?: number }
> {
  const result = await scheduleWorkoutOnCalendar(client, params);
  if (!result.ok) {
    return { ok: false, phase: "create", message: result.message, garminStatus: result.garminStatus };
  }
  return { ok: true, garminScheduleId: 0 };
}
