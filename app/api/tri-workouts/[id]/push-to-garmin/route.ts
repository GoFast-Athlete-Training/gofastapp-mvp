import { NextRequest, NextResponse } from "next/server";
import { resolveTrainingSubjectAthleteId } from "@/lib/training/resolve-training-subject-athlete";
import { GarminApiError } from "@/lib/garmin-workouts/garmin-training-api";
import { GarminNotConnectedError } from "@/lib/domain-garmin";
import { pushTriWorkoutToGarminForAthlete } from "@/lib/tri-workouts/push-tri-workout-for-athlete";
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
      /* empty */
    }

    const resolved = await resolveTrainingSubjectAthleteId(request, bodyAthleteId);
    if (!resolved.ok) return resolved.response;

    const { id } = await ctx.params;
    const result = await pushTriWorkoutToGarminForAthlete(resolved.athleteId, id);

    if (!result.ok) {
      if (result.code === "not_found") {
        return NextResponse.json({ error: "Tri workout not found" }, { status: 404 });
      }
      if (result.code === "no_legs") {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      return NextResponse.json(
        { error: result.message, legs: result.legs },
        { status: 502 }
      );
    }

    const tri = await prisma.tri_workout.findFirst({
      where: { id, athleteId: resolved.athleteId },
      include: {
        legs: {
          orderBy: { legOrder: "asc" },
          include: {
            bikeWorkout: true,
            swimWorkout: true,
            runWorkout: { select: { id: true, title: true, garminWorkoutId: true, garminScheduleId: true } },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      triWorkout: tri,
      scheduledDate: result.scheduledDate,
      legs: result.legs,
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
    console.error("[TRI_GARMIN_PUSH]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
