import { prisma } from "@/lib/prisma";
import { assembleGarminRacePlanWorkout } from "@/lib/garmin-workouts/assemble-garmin-race-plan";
import {
  GarminApiError,
  createGarminTrainingApiForAthlete,
} from "@/lib/garmin-workouts/garmin-training-api";
import {
  scheduleFailureToGarminApiResult,
  scheduleWorkoutOnCalendar,
} from "@/lib/garmin-workouts/garmin-schedule-service";
import { GarminNotConnectedError, requireGarminTokenFresh } from "@/lib/domain-garmin";
import { normalizeRacePlanDocument } from "@/lib/races/race-plan-builder";
import { racePlanHasBlocks } from "@/lib/races/race-plan-types";
import { ymdFromDate } from "@/lib/training/plan-utils";

export type PushRacePlanResult =
  | { ok: true; scheduledDate: string; racePlanId: string }
  | {
      ok: false;
      code: "not_found" | "no_blocks" | "garmin_disconnected" | "garmin_api" | "other";
      message: string;
      garminStatus?: number;
    };

export async function pushRacePlanToGarminForAthlete(
  athleteId: string,
  racePlanId: string
): Promise<PushRacePlanResult> {
  try {
    const row = await prisma.race_plans.findFirst({
      where: { id: racePlanId, athleteId },
    });
    if (!row) {
      return { ok: false, code: "not_found", message: "Race plan not found" };
    }

    const plan = normalizeRacePlanDocument(row.planJson);
    if (!racePlanHasBlocks(plan)) {
      return { ok: false, code: "no_blocks", message: "Save at least one race block first." };
    }

    const token = await requireGarminTokenFresh(athleteId);
    const scheduledDate = ymdFromDate(row.raceDate);
    const garminPayload = assembleGarminRacePlanWorkout({
      title: row.title,
      plan,
    });

    const client = createGarminTrainingApiForAthlete(athleteId, token);
    const createResult = await client.createWorkout(garminPayload);
    const garminWorkoutId = createResult?.workoutId;
    if (garminWorkoutId == null) {
      return {
        ok: false,
        code: "garmin_api",
        message: "Garmin did not return a workout id for scheduling",
      };
    }

    const scheduleResult = await scheduleWorkoutOnCalendar(client, {
      garminWorkoutId,
      scheduledDate,
    });
    if (!scheduleResult.ok) {
      const fail = scheduleFailureToGarminApiResult(scheduleResult);
      return {
        ok: false,
        code: "garmin_api",
        message: fail.message,
        garminStatus: fail.garminStatus,
      };
    }

    await prisma.race_plans.update({
      where: { id: row.id },
      data: {
        garminWorkoutId,
        pushedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return { ok: true, scheduledDate, racePlanId: row.id };
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
