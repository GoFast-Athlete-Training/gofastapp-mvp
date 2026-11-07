import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  AssignPlanDayError,
  assignBuiltWorkoutToPlanDay,
} from "@/lib/training/assign-built-workout-to-plan-day";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const planId = typeof body.planId === "string" ? body.planId.trim() : "";
  const dateKey = typeof body.date === "string" ? body.date.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "Workout";
  const workoutType = typeof body.workoutType === "string" ? body.workoutType.trim() : "Easy";
  const segments = body.segments;

  if (!planId || !dateKey) {
    return NextResponse.json({ error: "planId and date are required" }, { status: 400 });
  }

  try {
    const result = await assignBuiltWorkoutToPlanDay({
      athleteId: auth.athlete.id,
      planId,
      dateKey,
      title,
      workoutType,
      segments,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const msg = e instanceof AssignPlanDayError ? e.message : e instanceof Error ? e.message : "Failed";
    const status =
      e instanceof AssignPlanDayError && msg.includes("logged") ? 409 : 400;
    console.error("POST /api/training/plan-day/assign", e);
    return NextResponse.json({ error: msg }, { status });
  }
}
