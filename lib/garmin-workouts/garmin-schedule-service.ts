/**
 * Garmin Training API calendar schedule lifecycle.
 *
 * Workout CRUD (garminWorkoutId) and schedule CRUD (garminScheduleId) are separate resources:
 * - POST /workout -> library definition
 * - POST /schedule -> calendar placement for a date
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

export type ScheduleAndVerifySuccess = {
  ok: true;
  garminScheduleId: number;
};

export type ScheduleAndVerifyFailure = {
  ok: false;
  phase: "create" | "verify";
  message: string;
  garminStatus?: number;
};

export type ScheduleAndVerifyResult =
  | ScheduleAndVerifySuccess
  | ScheduleAndVerifyFailure;

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
 * POST /schedule then GET /schedule/{id} to confirm workout id and date.
 */
export async function scheduleAndVerifyWorkout(
  client: GarminScheduleClient,
  params: { garminWorkoutId: number; scheduledDate: string }
): Promise<ScheduleAndVerifyResult> {
  const { garminWorkoutId, scheduledDate } = params;

  let garminScheduleId: number;
  try {
    const scheduleResult = await client.scheduleWorkout(
      garminWorkoutId,
      scheduledDate
    );
    garminScheduleId = scheduleResult.scheduleId;
  } catch (e) {
    const message =
      e instanceof GarminApiError
        ? e.details || "Could not create Garmin calendar schedule"
        : e instanceof Error
          ? e.message
          : "Could not create Garmin calendar schedule";
    return {
      ok: false,
      phase: "create",
      message,
      garminStatus: e instanceof GarminApiError ? e.status : undefined,
    };
  }

  try {
    const verified = await client.getSchedule(garminScheduleId);
    if (verified.workoutId !== garminWorkoutId) {
      return {
        ok: false,
        phase: "verify",
        message: "Garmin schedule verification failed: workout id mismatch",
      };
    }
    const verifiedDate = verified.date?.slice(0, 10);
    if (verifiedDate && verifiedDate !== scheduledDate) {
      return {
        ok: false,
        phase: "verify",
        message: `Garmin schedule verification failed: expected ${scheduledDate}, got ${verifiedDate}`,
      };
    }
  } catch (e) {
    const message =
      e instanceof GarminApiError
        ? e.details || "Could not verify Garmin schedule"
        : e instanceof Error
          ? e.message
          : "Could not verify Garmin schedule";
    return {
      ok: false,
      phase: "verify",
      message,
      garminStatus: e instanceof GarminApiError ? e.status : undefined,
    };
  }

  return { ok: true, garminScheduleId };
}

export function scheduleFailureToGarminApiResult(
  failure: ScheduleAndVerifyFailure
): {
  code: "garmin_api";
  message: string;
  garminStatus?: number;
} {
  const prefix =
    failure.phase === "create"
      ? "Garmin calendar schedule failed"
      : "Garmin calendar verification failed";
  return {
    code: "garmin_api",
    message: failure.message.startsWith("Garmin")
      ? failure.message
      : `${prefix}: ${failure.message}`,
    garminStatus: failure.garminStatus,
  };
}
