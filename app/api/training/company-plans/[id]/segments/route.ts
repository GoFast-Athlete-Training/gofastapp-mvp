export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeCompanyPlanDaySegments } from "@/lib/training/company-plan-segment-write";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const { id } = await params;
  const plan = await prisma.training_plans.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!plan) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as {
    weekNumber?: unknown;
    dow?: unknown;
    title?: unknown;
    workoutType?: unknown;
    steps?: unknown;
  } | null;
  if (!body) {
    return NextResponse.json({ success: false, error: "Invalid body" }, { status: 400 });
  }

  const result = await writeCompanyPlanDaySegments({
    planId: plan.id,
    weekNumber: Number(body.weekNumber),
    dow: Number(body.dow),
    title: body.title,
    workoutType: body.workoutType,
    steps: body.steps,
  });
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, plannedWorkoutId: result.plannedWorkoutId });
}
