import { prisma } from "@/lib/prisma";
import { assembleGarminWorkout } from "@/lib/garmin-workouts/garmin-training-service";
import {
  GarminApiError,
  createGarminTrainingApiForAthlete,
} from "@/lib/garmin-workouts/garmin-training-api";
import {
  scheduleFailureToGarminApiResult,
  scheduleWorkoutOnCalendar,
} from "@/lib/garmin-workouts/garmin-schedule-service";
import { GarminNotConnectedError, requireGarminTokenFresh } from "@/lib/domain-garmin";
import { dateForDayInWeek } from "@/lib/training/plan-schedule-dates";
import { dayNameToOurDow } from "@/lib/training/schedule-parser";
import { ymdFromDate } from "@/lib/training/plan-utils";
import { segmentSnapshotDocumentFromDbRows } from "@/lib/training/workout-segment-snapshot";
import { materializeWorkoutForPlanDay } from "@/lib/training/workout-materializer";
import { expandSegmentsForGarminPush } from "@/lib/training/segment-summary";
import { garminPushTitleForPlannedWorkout, garminTitleForWorkout } from "@/lib/training/garmin-activity-match-helpers";
import { normalizePaceTargetEncodingVersion } from "@/lib/workout-generator/pace-calculator";
import {
  type PushWorkoutToGarminOptions,
  normalizePushWorkoutOptions,
} from "@/lib/garmin-workouts/garmin-calendar-state";

export type { PushWorkoutToGarminOptions };
export { garminCalendarSyncState, garminCalendarStateLabel } from "@/lib/garmin-workouts/garmin-calendar-state";

export type PushWorkoutForAthleteResult =
  | {
      ok: true;
      scheduledDate: string;
      workoutPushed: true;
      isUpdatedResend: boolean;
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

function segmentSnapshotFromWorkout(
  segments: Array<{
    stepOrder: number;
    title: string;
    durationType: string;
    durationValue: number;
    targets: unknown;
    repeatCount: number | null;
    notes: string | null;
    paceTargetEncodingVersion: number | null;
    recoveryDurationType?: string | null;
    recoveryDurationValue?: number | null;
  }>
) {
  return segmentSnapshotDocumentFromDbRows(
    [...segments].sort((a, b) => a.stepOrder - b.stepOrder).map((seg) => ({
      stepOrder: seg.stepOrder,
      title: seg.title,
      durationType: seg.durationType,
      durationValue: seg.durationValue,
      targets: seg.targets,
      repeatCount: seg.repeatCount,
      notes: seg.notes,
      paceTargetEncodingVersion: normalizePaceTargetEncodingVersion(
        seg.paceTargetEncodingVersion
      ),
      recoveryDurationType: seg.recoveryDurationType ?? null,
      recoveryDurationValue: seg.recoveryDurationValue ?? null,
    })),
    "garmin_push"
  );
}

/** Stack stamp: encoder is about to fire — not a Garmin receipt. */
async function stampPlannedWorkoutPushed(params: {
  plannedWorkoutId: string;
  snapshot: ReturnType<typeof segmentSnapshotFromWorkout>;
}): Promise<void> {
  await prisma.planned_workouts.update({
    where: { id: params.plannedWorkoutId },
    data: {
      workoutPushed: true,
      workoutEditedAfterPush: false,
      segmentSnapshotJson: params.snapshot,
      updatedAt: new Date(),
    },
  });
}

async function stampStandaloneWorkoutSnapshot(params: {
  workoutId: string;
  snapshot: ReturnType<typeof segmentSnapshotFromWorkout>;
}): Promise<void> {
  await prisma.workouts.update({
    where: { id: params.workoutId },
    data: { segmentSnapshotJson: params.snapshot },
  });
}

function withUpdatedGarminTitle(baseTitle: string, isUpdatedResend: boolean): string {
  if (!isUpdatedResend) return baseTitle;
  if (/^\(Updated\)\s/i.test(baseTitle)) return baseTitle;
  return `(Updated) ${baseTitle}`;
}

/**
 * Push a planned_workout prescribe tree to Garmin (canonical plan-day path).
 */
export async function pushPlannedWorkoutToGarminForAthlete(
  athleteId: string,
  plannedWorkoutId: string,
  optionsOrScheduleYmd?: string | PushWorkoutToGarminOptions
): Promise<PushWorkoutForAthleteResult> {
  const options = normalizePushWorkoutOptions(optionsOrScheduleYmd);

  try {
    const loadPlanned = () =>
      prisma.planned_workouts.findFirst({
        where: { id: plannedWorkoutId, athleteId },
        include: {
          segments: { orderBy: { stepOrder: "asc" } },
          training_plans: { select: { id: true, startDate: true } },
          workout_catalogue: { select: { name: true } },
        },
      });

    let planned = await loadPlanned();

    if (!planned) {
      return { ok: false, code: "not_found", message: "Planned workout not found" };
    }

    const isUpdatedResend = planned.workoutPushed;

    if (!planned.segments?.length && planned.planId && planned.date) {
      await materializeWorkoutForPlanDay({
        planId: planned.planId,
        athleteId,
        dateParam: ymdFromDate(planned.date),
      });
      planned = await loadPlanned();
    }

    if (!planned?.segments?.length) {
      return { ok: false, code: "no_segments", message: "Workout has no segments" };
    }

    let scheduledDate: string;
    if (options.scheduleDateYmdOverride?.trim()) {
      scheduledDate = options.scheduleDateYmdOverride.trim();
    } else if (
      planned.weekNumber != null &&
      planned.dayAssigned?.trim() &&
      planned.training_plans?.startDate
    ) {
      try {
        const ourDow = dayNameToOurDow(planned.dayAssigned);
        const canonical = dateForDayInWeek(
          planned.training_plans.startDate,
          planned.weekNumber,
          ourDow
        );
        scheduledDate = garminScheduleYmdFromDate(canonical);
      } catch {
        scheduledDate = garminScheduleYmdFromDate(planned.date);
      }
    } else {
      scheduledDate = garminScheduleYmdFromDate(planned.date);
    }

    const snapshot = segmentSnapshotFromWorkout(planned.segments);
    await stampPlannedWorkoutPushed({ plannedWorkoutId: planned.id, snapshot });

    const token = await requireGarminTokenFresh(athleteId);

    const baseTitle =
      planned.cityRunMatchLabel?.trim() ||
      garminPushTitleForPlannedWorkout({
        title: planned.title,
        weekNumber: planned.weekNumber,
        dayAssigned: planned.dayAssigned,
        catalogueName: planned.workout_catalogue?.name ?? null,
        planId: planned.planId,
        workoutType: planned.workoutType,
        estimatedDistanceInMeters: planned.estimatedDistanceInMeters,
      });
    const garminTitle = withUpdatedGarminTitle(baseTitle, isUpdatedResend);

    const garminSegments = expandSegmentsForGarminPush(
      planned.segments.map((seg) => ({
        ...seg,
        workoutId: planned!.id,
        id: seg.id,
      }))
    );

    const garminWorkoutPayload = assembleGarminWorkout({
      id: planned.id,
      title: garminTitle,
      workoutType: planned.workoutType,
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
    const createResult = await client.createWorkout(garminWorkoutPayload);
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
        code: fail.code,
        message: fail.message,
        garminStatus: fail.garminStatus,
      };
    }

    return {
      ok: true,
      scheduledDate,
      workoutPushed: true,
      isUpdatedResend,
    };
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

/**
 * Push a single workout to Garmin Training API for the owning athlete (no HTTP).
 * Plan days: resolves planned_workouts first; instance rows for standalone/spawned copies.
 */
export async function pushWorkoutToGarminForAthlete(
  athleteId: string,
  workoutId: string,
  optionsOrScheduleYmd?: string | PushWorkoutToGarminOptions
): Promise<PushWorkoutForAthleteResult> {
  const plannedFirst = await prisma.planned_workouts.findFirst({
    where: { id: workoutId, athleteId },
    select: { id: true },
  });
  if (plannedFirst) {
    return pushPlannedWorkoutToGarminForAthlete(athleteId, workoutId, optionsOrScheduleYmd);
  }

  const options = normalizePushWorkoutOptions(optionsOrScheduleYmd);

  try {
    const loadWorkout = () =>
      prisma.workouts.findFirst({
        where: { id: workoutId, athleteId },
        include: {
          segments: { orderBy: { stepOrder: "asc" } },
          training_plans: { select: { id: true, startDate: true } },
          workout_catalogue: { select: { name: true } },
          planned_workout: {
            select: { id: true, planId: true, date: true },
          },
        },
      });

    let workout = await loadWorkout();

    if (!workout) {
      return { ok: false, code: "not_found", message: "Workout not found" };
    }

    if (
      workout.plannedWorkoutId &&
      workout.planned_workout?.planId &&
      workout.planned_workout.date
    ) {
      return pushPlannedWorkoutToGarminForAthlete(
        athleteId,
        workout.plannedWorkoutId,
        optionsOrScheduleYmd
      );
    }

    if (!workout.segments?.length && workout.planId && workout.date) {
      const materialized = await materializeWorkoutForPlanDay({
        planId: workout.planId,
        athleteId,
        dateParam: ymdFromDate(workout.date),
      });
      return pushPlannedWorkoutToGarminForAthlete(
        athleteId,
        materialized.plannedWorkoutId,
        optionsOrScheduleYmd
      );
    }

    if (!workout?.segments?.length) {
      return { ok: false, code: "no_segments", message: "Workout has no segments" };
    }

    let scheduledDate: string;
    if (options.scheduleDateYmdOverride?.trim()) {
      scheduledDate = options.scheduleDateYmdOverride.trim();
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

    const garminTitle =
      workout.planId != null
        ? garminPushTitleForPlannedWorkout({
            title: workout.title,
            weekNumber: workout.weekNumber,
            dayAssigned: workout.dayAssigned,
            catalogueName: workout.workout_catalogue?.name ?? null,
            planId: workout.planId,
            workoutType: workout.workoutType,
            estimatedDistanceInMeters: workout.estimatedDistanceInMeters,
          })
        : garminTitleForWorkout({
            title: workout.title,
            weekNumber: workout.weekNumber,
          });

    const garminSegments = expandSegmentsForGarminPush(workout.segments);

    const garminWorkoutPayload = assembleGarminWorkout({
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
    const createResult = await client.createWorkout(garminWorkoutPayload);
    const garminWorkoutId = createResult?.workoutId;
    if (garminWorkoutId == null) {
      return {
        ok: false,
        code: "garmin_api",
        message: "Garmin did not return a workout id for scheduling",
      };
    }

    const snapshot = segmentSnapshotFromWorkout(workout.segments);
    await stampStandaloneWorkoutSnapshot({ workoutId: workout.id, snapshot });

    const scheduleResult = await scheduleWorkoutOnCalendar(client, {
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

    return {
      ok: true,
      scheduledDate,
      workoutPushed: true,
      isUpdatedResend: false,
    };
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
