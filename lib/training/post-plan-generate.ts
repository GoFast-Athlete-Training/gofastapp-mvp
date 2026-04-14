import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { executePlanGenerate } from "@/lib/training/execute-plan-generate";

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
      include: {
        race_registry: true,
      },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (!plan.race_registry) {
      return NextResponse.json(
        { error: "Plan must have a race" },
        { status: 400 }
      );
    }

    const scheduleExists =
      plan.planWeeks != null &&
      Array.isArray(plan.planWeeks) &&
      (plan.planWeeks as unknown[]).length > 0;
    if (scheduleExists) {
      return NextResponse.json(
        {
          error:
            "Plan already has a generated schedule; delete the plan or clear schedule to regenerate.",
        },
        { status: 400 }
      );
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
        : plan.weeklyMileageTarget ??
          prefs?.weeklyMileageTarget ??
          athlete.weeklyMileage ??
          45;

    weeklyMileageTarget = Math.max(
      minWeeklyMiles,
      Math.min(100, weeklyMileageTarget)
    );

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
        currentFiveKPace: plan.currentFiveKPace,
        weeklyMileageTarget: plan.weeklyMileageTarget,
        race_registry: {
          raceDate: plan.race_registry.raceDate,
          name: plan.race_registry.name,
          distanceMeters: plan.race_registry.distanceMeters,
        },
      },
      weeklyMileageTarget,
      minWeeklyMiles,
    });

    return NextResponse.json({
      success: true,
      planId: result.planId,
      weekCount: result.weekCount,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Plan generation failed";
    console.error("POST plan generate", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
