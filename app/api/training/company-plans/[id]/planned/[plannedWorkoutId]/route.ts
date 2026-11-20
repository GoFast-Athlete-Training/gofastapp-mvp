export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  loadCompanyPlanPlannedWorkout,
  saveCompanyPlanPlannedWorkoutSegments,
} from "@/lib/training/company-plan-planned-workout";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";

type Params = { params: Promise<{ id: string; plannedWorkoutId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const { id, plannedWorkoutId } = await params;
  const workout = await loadCompanyPlanPlannedWorkout(id, plannedWorkoutId);
  if (!workout) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, workout });
}

export async function PUT(request: NextRequest, { params }: Params) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const { id, plannedWorkoutId } = await params;
  const body = (await request.json().catch(() => null)) as { segments?: unknown } | null;
  if (!body || !("segments" in body)) {
    return NextResponse.json({ success: false, error: "Invalid body" }, { status: 400 });
  }

  const result = await saveCompanyPlanPlannedWorkoutSegments(id, plannedWorkoutId, body.segments);
  if (!result.ok) {
    const status = result.error === "Plan not found" ? 404 : 400;
    return NextResponse.json({ success: false, error: result.error }, { status });
  }
  return NextResponse.json({ success: true, workout: result.workout });
}
