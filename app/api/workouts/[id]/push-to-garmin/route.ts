import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAthleteByFirebaseId } from "@/lib/domain-athlete";
import { adminAuth } from "@/lib/firebaseAdmin";
import { assembleGarminWorkout } from "@/lib/garmin-workouts/garmin-training-service";
import { GarminApiError } from "@/lib/garmin-workouts/api-client";
import {
  GarminConnectionError,
  getGarminClient,
  getGarminClientForMode,
} from "@/lib/garmin-workouts/get-garmin-client";

export const dynamic = "force-dynamic";

/**
 * POST /api/workouts/[id]/push-to-garmin
 * Push a workout to Garmin Connect
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    const athlete = await getAthleteByFirebaseId(decodedToken.uid);
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const { id } = await params;

    // Get workout with segments
    const workout = await prisma.workouts.findFirst({
      where: {
        id,
        athleteId: athlete.id,
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

    // Resolve Garmin context (token + canonical Garmin user identity)
    let { client, garminUserId, tokenMode } = await getGarminClient(athlete.id);

    // Assemble Garmin workout from workout + segments
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
      })),
    });

    // Push to Garmin with Garmin token auth (never internal athlete/workout ids as Garmin identity)
    console.log("[GarminPush] Sending workout", {
      workoutId: workout.id,
      athleteId: athlete.id,
      garminUserId,
      tokenMode,
      endpoint: "/training-api/workout",
    });
    let garminWorkoutId: number;
    try {
      const result = await client.createWorkout(garminWorkout);
      garminWorkoutId = result.workoutId;
    } catch (pushError: unknown) {
      const shouldFallbackToProd =
        pushError instanceof GarminApiError &&
        tokenMode === "test" &&
        /unable to read oauth header/i.test(pushError.details);

      if (!shouldFallbackToProd) {
        throw pushError;
      }

      console.warn("[GarminPush] Test token rejected by Garmin; retrying with production token");
      const fallback = await getGarminClientForMode(athlete.id, { preferTest: false });
      client = fallback.client;
      garminUserId = fallback.garminUserId;
      tokenMode = fallback.tokenMode;

      console.log("[GarminPush] Retrying workout push", {
        workoutId: workout.id,
        athleteId: athlete.id,
        garminUserId,
        tokenMode,
        endpoint: "/training-api/workout",
      });
      const retryResult = await client.createWorkout(garminWorkout);
      garminWorkoutId = retryResult.workoutId;
    }

    await prisma.workouts.update({
      where: { id: workout.id },
      data: { garminWorkoutId },
    });

    return NextResponse.json({
      success: true,
      workout: { ...workout, garminWorkoutId },
      garminWorkoutId,
    });
  } catch (error: unknown) {
    if (error instanceof GarminConnectionError) {
      return NextResponse.json(
        { error: error.message, status: error.status, details: error.details ?? null },
        { status: error.status }
      );
    }

    if (error instanceof GarminApiError) {
      console.error("[GarminPush] Garmin API error", {
        status: error.status,
        details: error.details,
        url: error.url,
        body: error.rawBody,
      });
      return NextResponse.json(
        {
          error: "Failed to push workout to Garmin",
          status: error.status,
          details: error.details,
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
