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
  type GarminPushMode,
  garminCalendarSyncState,
  normalizePushWorkoutOptions,
  type PushWorkoutToGarminOptions,
} from "@/lib/garmin-workouts/garmin-calendar-state";

export type { GarminPushMode, PushWorkoutToGarminOptions };
export { garminCalendarSyncState, garminCalendarStateLabel } from "@/lib/garmin-workouts/garmin-calendar-state";

export type PushWorkoutForAthleteResult =
  | {
      ok: true;
      garminWorkoutId: number;
      garminScheduleId: number | null;
      scheduledDate: string;
      mode: GarminPushMode;
      calendarState: "scheduled_on_calendar" | "library_only";
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

type WorkoutGarminLookup = {
  id: string;
  planId: string | null;
  date: Date | null;
  weekNumber: number | null;
  dayAssigned: string | null;
  garminWorkoutId: number | null;
};

type PlannedGarminLookup = WorkoutGarminLookup;

/** Reuse Garmin id from sibling planned rows (prevents duplicate library entries). */
async function resolveGarminWorkoutIdForPlannedPush(
  athleteId: string,
  planned: PlannedGarminLookup
): Promise<number | null> {
  if (planned.garminWorkoutId != null) return planned.garminWorkoutId;

  const siblingWhere = {
    athleteId,
    id: { not: planned.id },
    garminWorkoutId: { not: null },
  };

  if (planned.planId && planned.date) {
    const byDate = await prisma.planned_workouts.findFirst({
      where: { ...siblingWhere, planId: planned.planId, date: planned.date },
      orderBy: { updatedAt: "desc" },
      select: { garminWorkoutId: true },
    });
    if (byDate?.garminWorkoutId != null) return byDate.garminWorkoutId;
  }

  if (planned.planId && planned.weekNumber != null && planned.dayAssigned?.trim()) {
    const byPlanDay = await prisma.planned_workouts.findFirst({
      where: {
        ...siblingWhere,
        planId: planned.planId,
        weekNumber: planned.weekNumber,
        dayAssigned: planned.dayAssigned.trim(),
      },
      orderBy: { updatedAt: "desc" },
      select: { garminWorkoutId: true },
    });
    if (byPlanDay?.garminWorkoutId != null) return byPlanDay.garminWorkoutId;
  }

  return null;
}

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
    const byDate = await prisma.planned_workouts.findFirst({
      where: { ...siblingWhere, planId: workout.planId, date: workout.date },
      orderBy: { updatedAt: "desc" },
      select: { garminWorkoutId: true },
    });
    if (byDate?.garminWorkoutId != null) return byDate.garminWorkoutId;

    const legacyByDate = await prisma.workouts.findFirst({
      where: { ...siblingWhere, planId: workout.planId, date: workout.date },
      orderBy: { updatedAt: "desc" },
      select: { garminWorkoutId: true },
    });
    if (legacyByDate?.garminWorkoutId != null) return legacyByDate.garminWorkoutId;
  }

  if (workout.planId && workout.weekNumber != null && workout.dayAssigned?.trim()) {
    const byPlanDay = await prisma.planned_workouts.findFirst({
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

    const legacyByPlanDay = await prisma.workouts.findFirst({
      where: {
        ...siblingWhere,
        planId: workout.planId,
        weekNumber: workout.weekNumber,
        dayAssigned: workout.dayAssigned.trim(),
      },
      orderBy: { updatedAt: "desc" },
      select: { garminWorkoutId: true },
    });
    if (legacyByPlanDay?.garminWorkoutId != null) return legacyByPlanDay.garminWorkoutId;
  }

  return null;
}

async function persistGarminPlannedPush(params: {
  plannedWorkoutId: string;
  garminWorkoutId: number;
  garminScheduleId?: number | null;
  snapshot: ReturnType<typeof segmentSnapshotFromWorkout>;
}): Promise<void> {
  await prisma.planned_workouts.update({
    where: { id: params.plannedWorkoutId },
    data: {
      garminWorkoutId: params.garminWorkoutId,
      ...(params.garminScheduleId !== undefined
        ? { garminScheduleId: params.garminScheduleId }
        : {}),
      segmentSnapshotJson: params.snapshot,
      updatedAt: new Date(),
    },
  });
}

async function persistGarminWorkoutPush(params: {
  workoutId: string;
  garminWorkoutId: number;
  snapshot: ReturnType<typeof segmentSnapshotFromWorkout>;
}): Promise<void> {
  await prisma.workouts.update({
    where: { id: params.workoutId },
    data: {
      garminWorkoutId: params.garminWorkoutId,
      segmentSnapshotJson: params.snapshot,
    },
  });
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

/**
 * Push a planned_workout prescribe tree to Garmin (canonical plan-day path).
 */
export async function pushPlannedWorkoutToGarminForAthlete(
  athleteId: string,
  plannedWorkoutId: string,
  optionsOrScheduleYmd?: string | PushWorkoutToGarminOptions
): Promise<PushWorkoutForAthleteResult> {
  const options = normalizePushWorkoutOptions(optionsOrScheduleYmd);
  const mode: GarminPushMode = options.mode ?? "schedule-today";

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

    const hadGarminWorkoutId = planned.garminWorkoutId != null;

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

    const token = await requireGarminTokenFresh(athleteId);

    const garminTitle =
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

    let garminWorkoutId = await resolveGarminWorkoutIdForPlannedPush(athleteId, {
      id: planned.id,
      planId: planned.planId,
      date: planned.date,
      weekNumber: planned.weekNumber,
      dayAssigned: planned.dayAssigned,
      garminWorkoutId: planned.garminWorkoutId,
    });

    if (garminWorkoutId != null) {
      try {
        await client.updateWorkout(garminWorkoutId, garminWorkoutPayload);
      } catch (e) {
        if (e instanceof GarminApiError && e.status === 404) {
          const result = await client.createWorkout(garminWorkoutPayload);
          garminWorkoutId = result.workoutId;
        } else {
          throw e;
        }
      }
    } else {
      const result = await client.createWorkout(garminWorkoutPayload);
      garminWorkoutId = result.workoutId;
    }

    const snapshot = segmentSnapshotFromWorkout(planned.segments);

    await persistGarminPlannedPush({
      plannedWorkoutId: planned.id,
      garminWorkoutId,
      snapshot,
    });

    const shouldScheduleCalendar =
      mode === "force-reschedule" || (!hadGarminWorkoutId && mode !== "update-library");

    if (mode === "update-library" || !shouldScheduleCalendar) {
      return {
        ok: true,
        garminWorkoutId,
        garminScheduleId: planned.garminScheduleId,
        scheduledDate,
        mode: mode === "schedule-today" && hadGarminWorkoutId ? "update-library" : mode,
        calendarState: "scheduled_on_calendar",
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

    await persistGarminPlannedPush({
      plannedWorkoutId: planned.id,
      garminWorkoutId,
      snapshot,
    });

    return {
      ok: true,
      garminWorkoutId,
      garminScheduleId: null,
      scheduledDate,
      mode,
      calendarState: "scheduled_on_calendar",
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
  const mode: GarminPushMode = options.mode ?? "schedule-today";

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

    const hadGarminWorkoutId = workout.garminWorkoutId != null;

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
        await client.updateWorkout(garminWorkoutId, garminWorkoutPayload);
      } catch (e) {
        if (e instanceof GarminApiError && e.status === 404) {
          const result = await client.createWorkout(garminWorkoutPayload);
          garminWorkoutId = result.workoutId;
        } else {
          throw e;
        }
      }
    } else {
      const result = await client.createWorkout(garminWorkoutPayload);
      garminWorkoutId = result.workoutId;
    }

    const snapshot = segmentSnapshotFromWorkout(workout.segments);

    await persistGarminWorkoutPush({
      workoutId: workout.id,
      garminWorkoutId,
      snapshot,
    });

    const shouldScheduleCalendar =
      mode === "force-reschedule" || (!hadGarminWorkoutId && mode !== "update-library");

    if (mode === "update-library" || !shouldScheduleCalendar) {
      return {
        ok: true,
        garminWorkoutId,
        garminScheduleId: workout.garminScheduleId,
        scheduledDate,
        mode: mode === "schedule-today" && hadGarminWorkoutId ? "update-library" : mode,
        calendarState: "scheduled_on_calendar",
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
      garminWorkoutId,
      garminScheduleId: null,
      scheduledDate,
      mode,
      calendarState: "scheduled_on_calendar",
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
