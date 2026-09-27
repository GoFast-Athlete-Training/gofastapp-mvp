export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  getRaceDayPlanState,
  RaceDayPlanError,
  upsertRaceDayPlannedWorkout,
} from "@/lib/training/save-race-day-planned-workout";

/** GET — schedule slot + optional athlete-built race segments (no catalogue materialize). */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("planId")?.trim();
    const date = searchParams.get("date")?.trim();
    if (!planId || !date) {
      return NextResponse.json({ error: "planId and date are required" }, { status: 400 });
    }

    const state = await getRaceDayPlanState({
      athleteId: auth.athlete.id,
      planId,
      dateParam: date,
    });

    return NextResponse.json({
      scheduled: state.scheduled,
      plannedWorkoutId: state.plannedWorkoutId,
      segments: state.segments,
    });
  } catch (e: unknown) {
    const msg = e instanceof RaceDayPlanError ? e.message : e instanceof Error ? e.message : "Failed";
    const status = msg.includes("not a race") || msg.includes("not found") ? 404 : 400;
    console.error("GET /api/training/race-day", e);
    return NextResponse.json({ error: msg }, { status });
  }
}

/** POST — save athlete-built race segments on the plan day. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const planId = typeof body.planId === "string" ? body.planId.trim() : "";
    const date = typeof body.date === "string" ? body.date.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const segments = body.segments;

    if (!planId || !date) {
      return NextResponse.json({ error: "planId and date are required" }, { status: 400 });
    }

    const { plannedWorkoutId } = await upsertRaceDayPlannedWorkout({
      athleteId: auth.athlete.id,
      planId,
      dateParam: date,
      title,
      segments,
    });

    return NextResponse.json({ plannedWorkoutId, workoutId: plannedWorkoutId });
  } catch (e: unknown) {
    const msg = e instanceof RaceDayPlanError ? e.message : e instanceof Error ? e.message : "Failed";
    const status = msg.includes("not a race") || msg.includes("not found") ? 404 : 400;
    console.error("POST /api/training/race-day", e);
    return NextResponse.json({ error: msg }, { status });
  }
}
