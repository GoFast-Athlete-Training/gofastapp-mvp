export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import {
  archiveTrainingPlan,
  deleteTrainingPlan,
  pauseTrainingPlan,
  resumePausedPlan,
} from "@/lib/training/plan-lifecycle";
import { ensureTrainingPlanPresetLinked } from "@/lib/training/ensure-training-plan-preset-linked";
import { executePlanGenerate } from "@/lib/training/execute-plan-generate";
import { cleanupFuturePlanWorkoutsAfterRegenerate } from "@/lib/training/plan-regenerate-cleanup";
import { syncPlanAfterGenerate } from "@/lib/training/post-generate-sync";

const ACTIONS = new Set(["pause", "resume", "archive", "delete", "regenerate"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    weeklyMileageTarget?: unknown;
  } | null;
  const action = typeof body?.action === "string" ? body.action : "";
  if (!ACTIONS.has(action)) {
    return NextResponse.json(
      { success: false, error: "action must be pause, resume, archive, delete, or regenerate" },
      { status: 400 },
    );
  }

  const plan = await prisma.training_plans.findUnique({
    where: { id },
    select: {
      id: true,
      athleteId: true,
      presetId: true,
      startDate: true,
      preferredDays: true,
      preferredLongRunDow: true,
      preferredTempoDow: true,
      preferredIntervalDow: true,
      weeklyMileageTarget: true,
      currentWeeklyMileage: true,
    },
  });
  if (!plan) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  if (action === "delete") {
    const deleted = await deleteTrainingPlan({
      athleteId: plan.athleteId,
      planId: plan.id,
    });
    if (!deleted.ok) {
      return NextResponse.json({ success: false, error: deleted.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, deleted: true });
  }

  if (action === "pause") {
    const paused = await pauseTrainingPlan({
      athleteId: plan.athleteId,
      planId: plan.id,
    });
    if (!paused.ok) {
      return NextResponse.json({ success: false, error: paused.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, lifecycleStatus: "PAUSED" });
  }

  if (action === "resume") {
    const resumed = await resumePausedPlan({
      athleteId: plan.athleteId,
      planId: plan.id,
    });
    if (!resumed.ok) {
      return NextResponse.json({ success: false, error: resumed.error }, { status: 409 });
    }
    return NextResponse.json({ success: true, lifecycleStatus: "ACTIVE" });
  }

  if (action === "archive") {
    const archived = await archiveTrainingPlan(plan.athleteId, plan.id);
    if (!archived) {
      return NextResponse.json(
        { success: false, error: "Only the active plan can be archived" },
        { status: 400 },
      );
    }
    return NextResponse.json({ success: true, lifecycleStatus: "ARCHIVED" });
  }

  const athlete = await prisma.athlete.findUnique({
    where: { id: plan.athleteId },
    select: {
      fiveKPace: true,
      weeklyMileage: true,
      longRunCapabilityMiles: true,
      avgWeeklyMilesSnapshot: true,
    },
  });
  if (!athlete) {
    return NextResponse.json({ success: false, error: "Athlete not found" }, { status: 404 });
  }

  const presetLink = await ensureTrainingPlanPresetLinked({
    planId: plan.id,
    athleteId: plan.athleteId,
  });
  if (!presetLink.ok) {
    return NextResponse.json(
      { success: false, error: "This plan has no training preset to regenerate from." },
      { status: 422 },
    );
  }

  const rawTarget = body?.weeklyMileageTarget;
  const weeklyMileageTarget =
    typeof rawTarget === "number" && Number.isFinite(rawTarget)
      ? Math.round(rawTarget)
      : plan.weeklyMileageTarget ??
        (plan.currentWeeklyMileage != null ? Math.round(Number(plan.currentWeeklyMileage)) : null);
  if (weeklyMileageTarget == null || !Number.isFinite(weeklyMileageTarget)) {
    return NextResponse.json(
      { success: false, error: "weeklyMileageTarget is required to regenerate." },
      { status: 400 },
    );
  }

  try {
    const result = await executePlanGenerate({
      athleteId: plan.athleteId,
      athleteFiveKPace: athlete.fiveKPace,
      athleteWeeklyMileage: athlete.weeklyMileage,
      athleteLongRunMiles: athlete.longRunCapabilityMiles,
      athleteAvgWeeklyMiles: athlete.avgWeeklyMilesSnapshot,
      plan: {
        id: plan.id,
        presetId: plan.presetId,
        startDate: plan.startDate,
        preferredDays: plan.preferredDays ?? [],
        preferredLongRunDow: plan.preferredLongRunDow ?? null,
        preferredTempoDow: plan.preferredTempoDow ?? null,
        preferredIntervalDow: plan.preferredIntervalDow ?? null,
        weeklyMileageTarget: plan.weeklyMileageTarget,
      },
      weeklyMileageTarget,
      minWeeklyMiles: Math.max(25, Math.min(weeklyMileageTarget, 70)),
    });
    const cleanup = await cleanupFuturePlanWorkoutsAfterRegenerate({
      planId: plan.id,
      athleteId: plan.athleteId,
    });
    await syncPlanAfterGenerate({ athleteId: plan.athleteId });
    return NextResponse.json({
      success: true,
      planId: result.planId,
      weekCount: result.weekCount,
      clearedFutureWorkouts: cleanup.clearedFutureWorkouts,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Regenerate failed";
    console.error("POST company-plans actions regenerate", e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
