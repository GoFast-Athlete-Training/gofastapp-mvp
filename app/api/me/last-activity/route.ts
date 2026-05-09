export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { prisma } from "@/lib/prisma";

/** GET /api/me/last-activity — most recent synced activity by start time (chronological last run) */
export async function GET(_request: Request) {
  const auth = await requireAthleteFromBearer(_request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const row = await prisma.athlete_activities.findFirst({
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
        matched_workout: { select: { id: true } },
      },
    });

    if (!row) {
      return NextResponse.json({ activity: null });
    }

    const { matched_workout, ...rest } = row;
    return NextResponse.json({
      activity: {
        ...rest,
        startTime: rest.startTime?.toISOString() ?? null,
        linkedWorkoutId: matched_workout?.id ?? null,
      },
    });
  } catch (err: unknown) {
    console.error("GET /api/me/last-activity:", err);
    return NextResponse.json(
      {
        error: "Server error",
        details: err instanceof Error ? err.message : "Unknown",
      },
      { status: 500 }
    );
  }
}
