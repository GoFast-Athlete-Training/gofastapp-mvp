export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { prisma } from "@/lib/prisma";

/** GET /api/me/last-logged-workout — most recent workout linked to a synced activity */
export async function GET(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const w = await prisma.workouts.findFirst({
      where: {
        athleteId: auth.athlete.id,
        matchedActivityId: { not: null },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        workoutType: true,
        date: true,
        planId: true,
        actualAvgPaceSecPerMile: true,
        actualDistanceMeters: true,
        actualDurationSeconds: true,
        estimatedDistanceInMeters: true,
        paceDeltaSecPerMile: true,
        targetPaceSecPerMile: true,
        targetPaceSecPerMileHigh: true,
        hrDeltaBpm: true,
        creditedFiveKPaceSecPerMile: true,
        matched_activity: {
          select: { startTime: true },
        },
      },
    });

    if (!w) {
      const fallbackActivity = await prisma.athlete_activities.findFirst({
        where: {
          athleteId: auth.athlete.id,
          startTime: { not: null },
        },
        orderBy: { startTime: "desc" },
        select: {
          id: true,
          activityName: true,
          activityType: true,
          startTime: true,
          distance: true,
          duration: true,
          source: true,
        },
      });
      return NextResponse.json({
        workout: null,
        fallbackActivity: fallbackActivity
          ? {
              ...fallbackActivity,
              startTime: fallbackActivity.startTime?.toISOString() ?? null,
            }
          : null,
      });
    }

    const { matched_activity, ...rest } = w;
    return NextResponse.json({
      workout: {
        ...rest,
        date: rest.date?.toISOString() ?? null,
        activityStartTime: matched_activity?.startTime?.toISOString() ?? null,
      },
      fallbackActivity: null,
    });
  } catch (err: unknown) {
    console.error("GET /api/me/last-logged-workout:", err);
    return NextResponse.json(
      {
        error: "Server error",
        details: err instanceof Error ? err.message : "Unknown",
      },
      { status: 500 }
    );
  }
}
