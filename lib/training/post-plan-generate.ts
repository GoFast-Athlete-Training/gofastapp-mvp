import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { executePlanGenerate } from "@/lib/training/execute-plan-generate";
import { ensureTrainingPlanPresetLinked } from "@/lib/training/ensure-training-plan-preset-linked";
import { cleanupFuturePlanWorkoutsAfterRegenerate } from "@/lib/training/plan-regenerate-cleanup";
import { syncPlanAfterGenerate } from "@/lib/training/post-generate-sync";

export async function planGeneratePostHandler(
  request: NextRequest
): Promise<NextResponse> {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

    const body = await request.json();
    const trainingPlanId =
      typeof body.trainingPlanId === "string" ? body.trainingPlanId.trim() : "";
    if (!trainingPlanId) {
      return NextResponse.json(
        { error: "trainingPlanId is required (training_plans.id)" },
        { status: 400 }
      );
    }

    const plan = await prisma.training_plans.findFirst({
      where: { id: trainingPlanId, athleteId: athlete.id },
      include: { athlete_race: true },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (!plan.athlete_race) {
      return NextResponse.json(
        { error: "Plan must have athleteRaceId set before generation" },
        { status: 400 }
      );
    }

    const scheduleExists =
      plan.planSchedule != null &&
      Array.isArray(plan.planSchedule) &&
      (plan.planSchedule as unknown[]).length > 0;
    if (scheduleExists) {
      await prisma.training_plans.update({
        where: { id: trainingPlanId },
        data: {
          planSchedule: Prisma.JsonNull,
          cyclePoolData: Prisma.JsonNull,
          updatedAt: new Date(),
        },
      });
    }

    const prefs = await prisma.trainingPreferences.findUnique({
      where: { athleteId: athlete.id },
    });

    const rawMin = body.minWeeklyMiles;
    const minWeeklyMiles =
      typeof rawMin === "number" && Number.isFinite(rawMin)
        ? Math.max(25, Math.min(70, Math.round(rawMin)))
        : 40;

    const rawTarget = body.weeklyMileageTarget;
    let weeklyMileageTarget =
      typeof rawTarget === "number" && Number.isFinite(rawTarget)
        ? Math.round(rawTarget)
        : plan.weeklyMileageTarget ?? prefs?.weeklyMileageTarget ?? 45;

    weeklyMileageTarget = Math.max(
      minWeeklyMiles,
      Math.min(100, weeklyMileageTarget)
    );

    const rawIncluded =
      body.includedSecondaryAthleteRaceIds ?? body.includedSecondarySignupIds;
    const includedSecondaryAthleteRaceIds = Array.isArray(rawIncluded)
      ? rawIncluded.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      : undefined;

    const presetLink = await ensureTrainingPlanPresetLinked({
      planId: trainingPlanId,
      athleteId: athlete.id,
    });
    if (!presetLink.ok) {
      const msg =
        presetLink.kind === "plan_not_found"
          ? "Plan not found"
          : "This plan has no training preset. Your coach must assign a blueprint in GoFast Company, or re-create the plan after picking one in training setup.";
      return NextResponse.json(
        { error: msg },
        { status: presetLink.kind === "plan_not_found" ? 404 : 422 }
      );
    }

    const result = await executePlanGenerate({
      athleteId: athlete.id,
      athleteFiveKPace: athlete.fiveKPace,
      athleteWeeklyMileage: athlete.weeklyMileage,
      plan: {
        id: plan.id,
        presetId: plan.presetId,
        startDate: plan.startDate,
        preferredDays: plan.preferredDays ?? [],
        preferredLongRunDow: plan.preferredLongRunDow ?? null,
        preferredTempoDow: plan.preferredTempoDow ?? null,
        preferredIntervalDow: plan.preferredIntervalDow ?? null,
        currentFiveKPace: plan.currentFiveKPace,
        weeklyMileageTarget: plan.weeklyMileageTarget,
      },
      weeklyMileageTarget,
      minWeeklyMiles,
      includedSecondaryAthleteRaceIds,
      includedSecondarySignupIds: includedSecondaryAthleteRaceIds,
    });

    const cleanup = await cleanupFuturePlanWorkoutsAfterRegenerate({
      planId: trainingPlanId,
      athleteId: athlete.id,
    });

    const sync = await syncPlanAfterGenerate({ athleteId: athlete.id });

    return NextResponse.json({
      success: true,
      planId: result.planId,
      weekCount: result.weekCount,
      clearedFutureWorkouts: cleanup.clearedFutureWorkouts,
      clearedFuturePlannedWorkouts: cleanup.clearedFuturePlannedWorkouts,
      horizonMaterialized: sync.horizon.summary.materialized,
      horizonAlreadyReady: sync.horizon.summary.alreadyReady,
      garminPush: sync.garmin.summary,
      garminPushSkippedReason: sync.garmin.skippedReason,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Plan generation failed";
    console.error("POST plan generate", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
