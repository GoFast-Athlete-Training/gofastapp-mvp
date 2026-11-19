export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { editPlanScheduleRun } from "@/lib/training/plan-schedule-day-edit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const { id } = await params;
  const plan = await prisma.training_plans.findUnique({
    where: { id },
    select: { id: true, athleteId: true },
  });
  if (!plan) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as {
    weekNumber?: unknown;
    dow?: unknown;
    miles?: unknown;
    remove?: unknown;
    catalogueWorkoutId?: unknown;
    workoutType?: unknown;
  } | null;
  if (!body) {
    return NextResponse.json({ success: false, error: "Invalid body" }, { status: 400 });
  }

  const weekNumber = Number(body.weekNumber);
  const dow = Number(body.dow);
  const miles =
    body.miles == null || body.miles === ""
      ? undefined
      : Number(body.miles);
  const catalogueWorkoutId =
    typeof body.catalogueWorkoutId === "string" ? body.catalogueWorkoutId : undefined;
  const workoutType = typeof body.workoutType === "string" ? body.workoutType : undefined;
  const result = await editPlanScheduleRun({
    planId: plan.id,
    athleteId: plan.athleteId,
    weekNumber,
    dow,
    miles,
    remove: body.remove === true,
    catalogueWorkoutId,
    workoutType,
  });
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    success: true,
    planSchedule: result.planSchedule,
    ...(result.plannedWorkoutId ? { plannedWorkoutId: result.plannedWorkoutId } : {}),
  });
}
