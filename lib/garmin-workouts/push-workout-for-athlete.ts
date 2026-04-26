import { prisma } from "@/lib/prisma";
import { assembleGarminWorkout } from "@/lib/garmin-workouts/garmin-training-service";
import {
  GarminApiError,
  createGarminTrainingApiForAthlete,
} from "@/lib/garmin-workouts/garmin-training-api";
import { GarminNotConnectedError, requireGarminTokenFresh } from "@/lib/domain-garmin";
import { dateForDayInWeek, dayNameToOurDow } from "@/lib/training/schedule-parser";
import { ymdFromDate } from "@/lib/training/plan-utils";

export type PushWorkoutForAthleteResult =
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
        | "no_segments"
        | "no_schedule_date"
        | "garmin_disconnected"
        | "garmin_api"
        | "other";
      message: string;
      garminStatus?: number;
    };

function garminScheduleYmdFromDate(date: Date): string {
  return ymdFromDate(date);
}

function utcTodayYmd(): string {
  return ymdFromDate(new Date());
}

/**
 * Push a single workout to Garmin Training API for the owning athlete (no HTTP).
 * Used by POST /api/workouts/[id]/push-to-garmin and cron auto-push.
 */
export async function pushWorkoutToGarminForAthlete(
  athleteId: string,
  workoutId: string,
  scheduleDateYmdOverride?: string
): Promise<PushWorkoutForAthleteResult> {
  try {
    const workout = await prisma.workouts.findFirst({
      where: { id: workoutId, athleteId },
      include: {
        segments: { orderBy: { stepOrder: "asc" } },
        training_plans: { select: { id: true, startDate: true } },
      },
    });

    if (!workout) {
      return { ok: false, code: "not_found", message: "Workout not found" };
    }

    if (!workout.segments?.length) {
      return { ok: false, code: "no_segments", message: "Workout has no segments" };
    }

    let scheduledDate: string;
    if (scheduleDateYmdOverride?.trim()) {
      scheduledDate = scheduleDateYmdOverride.trim();
    } else if (
      workout.planId &&
      workout.weekNumber != null &&
      workout.dayAssigned?.trim() &&
      workout.training_plans?.startDate
    ) {
      try {
        const ourDow = dayNameToOurDow(workout.dayAssigned);
        const canonical = dateForDayInWeek(
          workout.training_plans.startDate,
          workout.weekNumber,
          ourDow
        );
        scheduledDate = garminScheduleYmdFromDate(canonical);
      } catch {
        if (!workout.date) {
          return {
            ok: false,
            code: "no_schedule_date",
            message:
              "Workout must have a scheduled date to add to your Garmin calendar.",
          };
        }
        scheduledDate = garminScheduleYmdFromDate(workout.date);
      }
    } else if (workout.date) {
      scheduledDate = garminScheduleYmdFromDate(workout.date);
    } else {
      scheduledDate = utcTodayYmd();
    }

    const token = await requireGarminTokenFresh(athleteId);

    const garminWorkout = assembleGarminWorkout({
      id: workout.id,
      title: workout.title,
      workoutType: workout.workoutType,
      description: workout.description || undefined,
      segments: workout.segments.map((seg) => ({
        id: seg.id,
        workoutId: seg.workoutId,
        stepOrder: seg.stepOrder,
        title: seg.title,
        durationType: seg.durationType as "DISTANCE" | "TIME",
        durationValue: seg.durationValue,
        targets: seg.targets as Array<{
          type: string;
          valueLow?: number;
          valueHigh?: number;
          value?: number;
        }> | undefined,
        repeatCount: seg.repeatCount || undefined,
        notes: seg.notes || undefined,
        paceTargetEncodingVersion: seg.paceTargetEncodingVersion,
      })),
    });

    const client = createGarminTrainingApiForAthlete(athleteId, token);

    let garminWorkoutId = workout.garminWorkoutId;
    if (garminWorkoutId != null) {
      await client.updateWorkout(garminWorkoutId, garminWorkout);
    } else {
      const result = await client.createWorkout(garminWorkout);
      garminWorkoutId = result.workoutId;
    }

    if (workout.garminScheduleId != null) {
      try {
        await client.deleteSchedule(workout.garminScheduleId);
      } catch (e) {
        if (!(e instanceof GarminApiError && e.status === 404)) {
          throw e;
        }
      }
    }

    const scheduleResult = await client.scheduleWorkout(garminWorkoutId, scheduledDate);
    const garminScheduleId = scheduleResult.scheduleId;

    await prisma.workouts.update({
      where: { id: workout.id },
      data: { garminWorkoutId, garminScheduleId },
    });

    return { ok: true, garminWorkoutId, garminScheduleId, scheduledDate };
  } catch (error: unknown) {
    if (error instanceof GarminNotConnectedError) {
      return {
        ok: false,
        code: "garmin_disconnected",
        message: error.message,
      };
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
