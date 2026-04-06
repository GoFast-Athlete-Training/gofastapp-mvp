import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { assembleGarminWorkout } from "@/lib/garmin-workouts/garmin-training-service";
import {
  GarminApiError,
  createGarminTrainingApiForAthlete,
} from "@/lib/garmin-workouts/garmin-training-api";
import {
  GarminNotConnectedError,
  requireGarminTokenFresh,
} from "@/lib/domain-garmin";
import { summarizeGarminTokenForLogs } from "@/lib/garmin-access-token-claims";
import { dateForDayInWeek, dayNameToOurDow } from "@/lib/training/schedule-parser";
import { ymdFromDate } from "@/lib/training/plan-utils";

export const dynamic = "force-dynamic";

/** Calendar YYYY-MM-DD in UTC — same as plan generation (`ymdFromDate` / Mon–Sun UTC weeks). */
function garminScheduleYmdFromDate(date: Date): string {
  return ymdFromDate(date);
}

/** UTC “today” as a calendar date when a standalone workout has no `date` (optional on create). */
function utcTodayYmd(): string {
  return ymdFromDate(new Date());
}

/**
 * POST /api/workouts/[id]/push-to-garmin
 * Auth: Firebase Bearer + x-athlete-id (see lib/api.ts). Pushes to Garmin Training API with the athlete's stored OAuth2 token.
 * Creates or updates the workout, then schedules it on the workout's date so it appears on Garmin Connect / the watch calendar.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let garminAccessTokenForLogs: string | undefined;
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;

    const workout = await prisma.workouts.findFirst({
      where: {
        id,
        athleteId: auth.athlete.id,
      },
      include: {
        segments: {
          orderBy: { stepOrder: "asc" },
        },
        training_plans: {
          select: { id: true, startDate: true },
        },
      },
    });

    if (!workout) {
      return NextResponse.json({ error: "Workout not found" }, { status: 404 });
    }

    if (!workout.segments || workout.segments.length === 0) {
      return NextResponse.json(
        { error: "Workout has no segments" },
        { status: 400 }
      );
    }

    let scheduledDate: string;
    if (
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
          return NextResponse.json(
            {
              error:
                "Workout must have a scheduled date to add to your Garmin calendar. Set a date on the workout first.",
            },
            { status: 400 }
          );
        }
        scheduledDate = garminScheduleYmdFromDate(workout.date);
      }
    } else if (workout.date) {
      scheduledDate = garminScheduleYmdFromDate(workout.date);
    } else {
      scheduledDate = utcTodayYmd();
      console.warn(
        `[GARMIN_PUSH] workout ${id} has no workout.date (common for standalone create); scheduling on Garmin for UTC calendar today ${scheduledDate}. Set a date on the workout to pick another day.`
      );
    }

    console.log(
      "[GARMIN_PUSH] schedule",
      JSON.stringify({
        scheduledDate,
        source:
          workout.planId &&
          workout.weekNumber != null &&
          workout.dayAssigned?.trim() &&
          workout.training_plans?.startDate
            ? "plan_week_day"
            : workout.date
              ? "workout_date"
              : "utc_today_fallback",
        workoutDateStored:
          workout.date != null ? workout.date.toISOString() : null,
      })
    );

    const token = await requireGarminTokenFresh(auth.athlete.id);
    garminAccessTokenForLogs = token;

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

    console.log(
      "[GARMIN_PUSH] assembled payload",
      JSON.stringify(garminWorkout, null, 2)
    );

    const client = createGarminTrainingApiForAthlete(auth.athlete.id, token);

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

    return NextResponse.json({
      success: true,
      workout: { ...workout, garminWorkoutId, garminScheduleId },
      garminWorkoutId,
      garminScheduleId,
      scheduledDate,
      debugPayload: garminWorkout,
    });
  } catch (error: unknown) {
    if (error instanceof GarminNotConnectedError) {
      return NextResponse.json(
        { error: error.message, status: 400 },
        { status: 400 }
      );
    }

    if (error instanceof GarminApiError) {
      const logLine = {
        status: error.status,
        details: error.details,
        rawBody: error.rawBody ?? null,
        url: error.url,
        tokenSummary: summarizeGarminTokenForLogs(garminAccessTokenForLogs),
      };
      console.error("[GARMIN_PUSH]", JSON.stringify(logLine));

      const debug = process.env.GARMIN_DEBUG === "true";
      return NextResponse.json(
        {
          error: "Failed to push workout to Garmin",
          status: error.status,
          details: error.details,
          ...(debug && error.rawBody !== undefined ? { rawBody: error.rawBody } : {}),
          ...(debug ? { tokenSummary: summarizeGarminTokenForLogs(garminAccessTokenForLogs) } : {}),
        },
        { status: error.status }
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error pushing workout to Garmin:", error);
    return NextResponse.json(
      { error: "Failed to push workout to Garmin", status: 500, details: message },
      { status: 500 }
    );
  }
}
