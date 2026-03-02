import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAthleteByFirebaseId } from "@/lib/domain-athlete";
import { adminAuth } from "@/lib/firebaseAdmin";
import { assembleGarminWorkout } from "@/lib/garmin-workouts/garmin-training-service";
import { GarminWorkoutApiClient } from "@/lib/garmin-workouts/api-client";
import { getValidAccessToken } from "@/lib/garmin-refresh-token";

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

    if (!athlete.garmin_is_connected || !athlete.garmin_user_id) {
      return NextResponse.json(
        { error: "Garmin not connected" },
        { status: 400 }
      );
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

    // Get Garmin access token
    const accessToken = await getValidAccessToken(athlete.id);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Failed to get Garmin access token" },
        { status: 500 }
      );
    }

    // Assemble Garmin workout from workout + segments
    const garminWorkout = assembleGarminWorkout({
      id: workout.id,
      title: workout.title,
      workoutType: workout.workoutType,
      description: workout.description || undefined,
      athleteId: workout.athleteId,
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

    // Push to Garmin
    const client = new GarminWorkoutApiClient(accessToken);
    const { workoutId: garminWorkoutId } = await client.createWorkout(garminWorkout);

    // Note: We don't store garminWorkoutId on the workout anymore
    // Garmin connection status lives on the Athlete model

    return NextResponse.json({
      success: true,
      workout,
      garminWorkoutId,
    });
  } catch (error: any) {
    console.error("Error pushing workout to Garmin:", error);
    return NextResponse.json(
      { error: "Failed to push workout to Garmin", details: error.message },
      { status: 500 }
    );
  }
}
