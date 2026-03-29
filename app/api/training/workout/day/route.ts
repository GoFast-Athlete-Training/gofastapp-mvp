export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { findOrCreateWorkoutForPlanDay } from "@/lib/training/workout-day-creator";

/**
 * GET /api/training/workout/day?planId=&date=
 * `date` = YYYY-MM-DD (UTC) or ISO datetime. Find-or-create `workouts` row for that plan day.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("planId");
    const date = searchParams.get("date");

    if (!planId?.trim() || !date?.trim()) {
      return NextResponse.json(
        { error: "planId and date are required" },
        { status: 400 }
      );
    }

    const { workoutId } = await findOrCreateWorkoutForPlanDay({
      planId: planId.trim(),
      athleteId: auth.athlete.id,
      dateParam: date.trim(),
    });

    return NextResponse.json({ workoutId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to resolve workout";
    const lower = msg.toLowerCase();
    const status =
      lower.includes("not found") || lower.includes("no scheduled")
        ? 404
        : lower.includes("missing") || lower.includes("invalid")
          ? 400
          : 500;
    console.error("GET /api/training/workout/day", e);
    return NextResponse.json({ error: msg }, { status });
  }
}
