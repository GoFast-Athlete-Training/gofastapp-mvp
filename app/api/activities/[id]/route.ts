export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/activities/[id]
 * Single athlete_activity for the authenticated athlete, with optional matched workout + segments.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const row = await prisma.athlete_activities.findFirst({
      where: {
        id: id.trim(),
        athleteId: auth.athlete.id,
      },
      include: {
        matched_workout: {
          include: {
            segments: { orderBy: { stepOrder: "asc" } },
            training_plans: {
              select: { id: true, name: true, currentFiveKPace: true },
            },
          },
        },
      },
    });

    if (!row) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    const { matched_workout, ...activity } = row;

    return NextResponse.json({
      activity: {
        ...activity,
        startTime: activity.startTime?.toISOString() ?? null,
        createdAt: activity.createdAt.toISOString(),
        updatedAt: activity.updatedAt.toISOString(),
        hydratedAt: activity.hydratedAt?.toISOString() ?? null,
      },
      matchedWorkout: matched_workout
        ? {
            ...matched_workout,
            date: matched_workout.date?.toISOString() ?? null,
            createdAt: matched_workout.createdAt.toISOString(),
            updatedAt: matched_workout.updatedAt.toISOString(),
            segments: matched_workout.segments.map((s) => ({
              ...s,
              createdAt: s.createdAt.toISOString(),
              updatedAt: s.updatedAt.toISOString(),
            })),
          }
        : null,
    });
  } catch (err: unknown) {
    console.error("GET /api/activities/[id]:", err);
    return NextResponse.json(
      {
        error: "Server error",
        details: err instanceof Error ? err.message : "Unknown",
      },
      { status: 500 }
    );
  }
}
