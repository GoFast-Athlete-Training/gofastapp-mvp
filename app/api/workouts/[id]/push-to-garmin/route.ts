export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { resolveWorkoutTargetForAthlete } from "@/lib/training/workout-or-planned-resolve";
import { GarminApiError } from "@/lib/garmin-workouts/garmin-training-api";
import { GarminNotConnectedError } from "@/lib/domain-garmin";
import { summarizeGarminTokenForLogs } from "@/lib/garmin-access-token-claims";
import { pushWorkoutToGarminForAthlete } from "@/lib/garmin-workouts/push-workout-for-athlete";

/**
 * POST /api/workouts/[id]/push-to-garmin
 * Auth: Firebase Bearer + x-athlete-id. Athlete taps "Looks good, I'm ready".
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

    const result = await pushWorkoutToGarminForAthlete(auth.athlete.id, id);

    if (!result.ok) {
      if (result.code === "not_found") {
        return NextResponse.json({ error: "Workout not found" }, { status: 404 });
      }
      if (result.code === "no_segments") {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      if (result.code === "no_schedule_date") {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      if (result.code === "garmin_disconnected") {
        return NextResponse.json(
          { error: result.message, status: 400 },
          { status: 400 }
        );
      }
      if (result.code === "garmin_api") {
        const debug = process.env.GARMIN_DEBUG === "true";
        return NextResponse.json(
          {
            error: "Failed to push workout to Garmin",
            status: result.garminStatus ?? 502,
            details: result.message,
            ...(debug ? { tokenSummary: summarizeGarminTokenForLogs(garminAccessTokenForLogs) } : {}),
          },
          { status: result.garminStatus ?? 502 }
        );
      }
      return NextResponse.json(
        { error: "Failed to push workout to Garmin", status: 500, details: result.message },
        { status: 500 }
      );
    }

    const target = await resolveWorkoutTargetForAthlete(id, auth.athlete.id);
    const workout =
      target?.kind === "standalone"
        ? await prisma.workouts.findFirst({
            where: { id: target.workoutId, athleteId: auth.athlete.id },
            include: {
              segments: { orderBy: { stepOrder: "asc" } },
              training_plans: { select: { id: true, startDate: true } },
            },
          })
        : target?.kind === "planned"
          ? await prisma.planned_workouts.findFirst({
              where: { id: target.plannedWorkoutId, athleteId: auth.athlete.id },
              include: {
                segments: { orderBy: { stepOrder: "asc" } },
                training_plans: { select: { id: true, startDate: true } },
              },
            })
          : null;

    return NextResponse.json({
      success: true,
      workout,
      workoutPushed: result.workoutPushed,
      isUpdatedResend: result.isUpdatedResend,
      scheduledDate: result.scheduledDate,
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
