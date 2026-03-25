export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";

const DEFAULT_LIMIT = 80;
const MAX_LIMIT = 200;

/**
 * GET /api/athlete/activities — recent Garmin (etc.) activities for the signed-in athlete.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

    const limitRaw = request.nextUrl.searchParams.get("limit");
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, limitRaw ? parseInt(limitRaw, 10) || DEFAULT_LIMIT : DEFAULT_LIMIT)
    );

    const rows = await prisma.athlete_activities.findMany({
      where: { athleteId: athlete.id },
      orderBy: { startTime: "desc" },
      take: limit,
      select: {
        id: true,
        sourceActivityId: true,
        source: true,
        ingestionStatus: true,
        activityType: true,
        activityName: true,
        startTime: true,
        duration: true,
        distance: true,
        averageSpeed: true,
        averageHeartRate: true,
        matched_workout: { select: { id: true, title: true } },
      },
    });

    const activities = rows.map((r) => ({
      id: r.id,
      sourceActivityId: r.sourceActivityId,
      source: r.source,
      ingestionStatus: r.ingestionStatus,
      activityType: r.activityType,
      activityName: r.activityName,
      startTime: r.startTime,
      duration: r.duration,
      distance: r.distance,
      averageSpeed: r.averageSpeed,
      averageHeartRate: r.averageHeartRate,
      matchedWorkoutId: r.matched_workout?.id ?? null,
      matchedWorkoutTitle: r.matched_workout?.title ?? null,
    }));

    return NextResponse.json({ activities });
  } catch (e: unknown) {
    console.error("GET /api/athlete/activities", e);
    return NextResponse.json({ error: "Failed to load activities" }, { status: 500 });
  }
}
