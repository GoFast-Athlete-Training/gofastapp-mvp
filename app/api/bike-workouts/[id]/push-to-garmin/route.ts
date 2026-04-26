import { NextRequest, NextResponse } from "next/server";
import { resolveTrainingSubjectAthleteId } from "@/lib/training/resolve-training-subject-athlete";
import { GarminApiError } from "@/lib/garmin-workouts/garmin-training-api";
import { GarminNotConnectedError } from "@/lib/domain-garmin";
import { pushBikeWorkoutToGarminForAthlete } from "@/lib/garmin-workouts/push-bike-workout-for-athlete";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    let bodyAthleteId: string | null = null;
    try {
      const body = await request.json();
      if (body && typeof body === "object" && typeof (body as { athleteId?: string }).athleteId === "string") {
        bodyAthleteId = (body as { athleteId: string }).athleteId;
      }
    } catch {
      /* empty body ok */
    }

    const resolved = await resolveTrainingSubjectAthleteId(request, bodyAthleteId);
    if (!resolved.ok) return resolved.response;

    const { id } = await ctx.params;
    const result = await pushBikeWorkoutToGarminForAthlete(resolved.athleteId, id);

    if (!result.ok) {
      if (result.code === "not_found") {
        return NextResponse.json({ error: "Bike workout not found" }, { status: 404 });
      }
      if (result.code === "no_steps") {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      if (result.code === "assemble") {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      if (result.code === "garmin_disconnected") {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      if (result.code === "garmin_api") {
        return NextResponse.json(
          { error: "Failed to push to Garmin", details: result.message, status: result.garminStatus },
          { status: result.garminStatus ?? 502 }
        );
      }
      return NextResponse.json({ error: result.message }, { status: 500 });
    }

    const workout = await prisma.bike_workout.findFirst({
      where: { id, athleteId: resolved.athleteId },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });

    return NextResponse.json({
      success: true,
      bikeWorkout: workout,
      garminWorkoutId: result.garminWorkoutId,
      garminScheduleId: result.garminScheduleId,
      scheduledDate: result.scheduledDate,
    });
  } catch (error: unknown) {
    if (error instanceof GarminNotConnectedError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof GarminApiError) {
      return NextResponse.json(
        { error: "Garmin API error", details: error.details, status: error.status },
        { status: error.status }
      );
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[BIKE_GARMIN_PUSH]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
