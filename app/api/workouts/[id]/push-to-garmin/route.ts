import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { assembleGarminWorkout } from "@/lib/garmin-workouts/garmin-training-service";
import {
  GarminApiError,
  createGarminTrainingApiForAthlete,
} from "@/lib/garmin-workouts/garmin-training-api";
import { GarminNotConnectedError, requireGarminToken } from "@/lib/domain-garmin";
import { summarizeGarminTokenForLogs } from "@/lib/garmin-access-token-claims";

export const dynamic = "force-dynamic";

function scheduleDateFromWorkoutDate(date: Date): string {
  return date.toISOString().slice(0, 10);
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

    if (!workout.date) {
      return NextResponse.json(
        {
          error:
            "Workout must have a scheduled date to add to your Garmin calendar. Set a date on the workout first.",
        },
        { status: 400 }
      );
    }

    const token = await requireGarminToken(auth.athlete.id);
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

    const scheduledDate = scheduleDateFromWorkoutDate(workout.date);
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
