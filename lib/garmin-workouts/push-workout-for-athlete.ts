import { prisma } from "@/lib/prisma";
import { assembleGarminWorkout } from "@/lib/garmin-workouts/garmin-training-service";
import {
  GarminApiError,
  createGarminTrainingApiForAthlete,
} from "@/lib/garmin-workouts/garmin-training-api";
import { GarminNotConnectedError, requireGarminTokenFresh } from "@/lib/domain-garmin";
import { dateForDayInWeek } from "@/lib/training/plan-schedule-dates";
import { dayNameToOurDow } from "@/lib/training/schedule-parser";
import { ymdFromDate } from "@/lib/training/plan-utils";
import { segmentSnapshotDocumentFromDbRows } from "@/lib/training/workout-segment-snapshot";
import { materializeWorkoutForPlanDay } from "@/lib/training/workout-materializer";
import { expandSegmentsForGarminPush } from "@/lib/training/segment-summary";

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

/** Avoid double-prefixing when title already has GF W1: or W1: style week label. */
export function garminTitleForWorkout(workout: {
  title: string;
  weekNumber: number | null;
}): string {
  const title = workout.title.trim();
  if (/^(GF\s+)?W\d+\s*:/i.test(title)) return title;
  if (workout.weekNumber != null && Number.isFinite(workout.weekNumber)) {
    return `GF W${workout.weekNumber}: ${title}`;
  }
  return title;
}

type WorkoutGarminLookup = {
  id: string;
  planId: string | null;
  date: Date | null;
  weekNumber: number | null;
  dayAssigned: string | null;
  garminWorkoutId: number | null;
};

/** Reuse Garmin id from this row or a sibling plan-day row (prevents duplicate library entries). */
async function resolveGarminWorkoutIdForPush(
  athleteId: string,
  workout: WorkoutGarminLookup
): Promise<number | null> {
  if (workout.garminWorkoutId != null) return workout.garminWorkoutId;

  const siblingWhere = {
    athleteId,
    id: { not: workout.id },
    garminWorkoutId: { not: null },
  };

  if (workout.planId && workout.date) {
    const byDate = await prisma.workouts.findFirst({
      where: { ...siblingWhere, planId: workout.planId, date: workout.date },
      orderBy: { updatedAt: "desc" },
      select: { garminWorkoutId: true },
    });
    if (byDate?.garminWorkoutId != null) return byDate.garminWorkoutId;
  }

  if (workout.planId && workout.weekNumber != null && workout.dayAssigned?.trim()) {
    const byPlanDay = await prisma.workouts.findFirst({
      where: {
        ...siblingWhere,
        planId: workout.planId,
        weekNumber: workout.weekNumber,
        dayAssigned: workout.dayAssigned.trim(),
      },
      orderBy: { updatedAt: "desc" },
      select: { garminWorkoutId: true },
    });
    if (byPlanDay?.garminWorkoutId != null) return byPlanDay.garminWorkoutId;
  }

  return null;
}

async function persistGarminWorkoutId(workoutId: string, garminWorkoutId: number): Promise<void> {
  await prisma.workouts.update({
    where: { id: workoutId },
    data: { garminWorkoutId },
  });
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
    const loadWorkout = () =>
      prisma.workouts.findFirst({
        where: { id: workoutId, athleteId },
        include: {
          segments: { orderBy: { stepOrder: "asc" } },
          training_plans: { select: { id: true, startDate: true } },
        },
      });

    let workout = await loadWorkout();

    if (!workout) {
      return { ok: false, code: "not_found", message: "Workout not found" };
    }

    if (!workout.segments?.length && workout.planId && workout.date) {
      await materializeWorkoutForPlanDay({
        planId: workout.planId,
        athleteId,
        dateParam: ymdFromDate(workout.date),
      });
      workout = await loadWorkout();
    }

    if (!workout?.segments?.length) {
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

    const garminTitle = garminTitleForWorkout({
      title: workout.title,
      weekNumber: workout.weekNumber,
    });

    const garminSegments = expandSegmentsForGarminPush(workout.segments);

    const garminWorkout = assembleGarminWorkout({
      id: workout.id,
      title: garminTitle,
      workoutType: workout.workoutType,
      description: workout.description || undefined,
      segments: garminSegments.map((seg) => ({
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
        recoveryDurationType: seg.recoveryDurationType ?? undefined,
        recoveryDurationValue:
          seg.recoveryDurationValue != null ? seg.recoveryDurationValue : undefined,
      })),
    });

    const client = createGarminTrainingApiForAthlete(athleteId, token);

    let garminWorkoutId = await resolveGarminWorkoutIdForPush(athleteId, {
      id: workout.id,
      planId: workout.planId,
      date: workout.date,
      weekNumber: workout.weekNumber,
      dayAssigned: workout.dayAssigned,
      garminWorkoutId: workout.garminWorkoutId,
    });

    if (garminWorkoutId != null) {
      try {
        await client.updateWorkout(garminWorkoutId, garminWorkout);
      } catch (e) {
        // Stale id after user deleted workouts in Garmin Connect — create fresh.
        if (e instanceof GarminApiError && e.status === 404) {
          const result = await client.createWorkout(garminWorkout);
          garminWorkoutId = result.workoutId;
          await persistGarminWorkoutId(workout.id, garminWorkoutId);
        } else {
          throw e;
        }
      }
    } else {
      const result = await client.createWorkout(garminWorkout);
      garminWorkoutId = result.workoutId;
      await persistGarminWorkoutId(workout.id, garminWorkoutId);
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
      data: {
        garminWorkoutId,
        garminScheduleId,
        segmentSnapshotJson: segmentSnapshotDocumentFromDbRows(
          [...workout.segments].sort((a, b) => a.stepOrder - b.stepOrder).map((seg) => ({
            stepOrder: seg.stepOrder,
            title: seg.title,
            durationType: seg.durationType,
            durationValue: seg.durationValue,
            targets: seg.targets,
            repeatCount: seg.repeatCount,
            notes: seg.notes,
            paceTargetEncodingVersion: seg.paceTargetEncodingVersion,
          })),
          "garmin_push"
        ),
      },
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
