export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import type { WorkoutType } from "@prisma/client";

/**
 * GET /api/workouts/catalogue-browse
 * Athlete-auth'd list of catalogue prescriptions for the standalone workout builder picker.
 * Optional: ?workoutType=Intervals (must match Prisma WorkoutType enum value).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const wtRaw = searchParams.get("workoutType")?.trim();

    const items = await prisma.workout_catalogue.findMany({
      where:
        wtRaw && wtRaw.length > 0 ? { workoutType: wtRaw as WorkoutType } : undefined,
      orderBy: [{ workoutType: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        workoutType: true,
        workBaseReps: true,
        workBaseRepMeters: true,
        recoveryDistanceMeters: true,
        recoveryDurationSeconds: true,
        warmupMiles: true,
        cooldownMiles: true,
      },
    });

    return NextResponse.json({ items });
  } catch (e: unknown) {
    console.error("GET /api/workouts/catalogue-browse", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
