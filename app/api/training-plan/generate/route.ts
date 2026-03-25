export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { generatePlanOutlineWithOpenAI } from "@/lib/training/plan-generate-ai";
import { preferredDaysToHuman } from "@/lib/training/plan-utils";

/**
 * POST /api/training-plan/generate
 * Body: { trainingPlanId }
 * One AI call → phases + planWeeks on training_plans.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

    const body = await request.json();
    const trainingPlanId = body.trainingPlanId as string | undefined;
    if (!trainingPlanId) {
      return NextResponse.json(
        { error: "trainingPlanId is required" },
        { status: 400 }
      );
    }

    const plan = await prisma.training_plans.findFirst({
      where: { id: trainingPlanId, athleteId: athlete.id },
      include: {
        race_registry: true,
        athlete_goal: true,
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

    if (
      plan.planWeeks != null &&
      Array.isArray(plan.planWeeks) &&
      (plan.planWeeks as unknown[]).length > 0
    ) {
      return NextResponse.json(
        { error: "Plan already generated" },
        { status: 400 }
      );
    }

    const race = plan.race_registry;
    const preferredDays =
      plan.preferredDays?.length > 0
        ? plan.preferredDays
        : [1, 2, 3, 4, 5, 6];

    const outline = await generatePlanOutlineWithOpenAI({
      totalWeeks: plan.totalWeeks,
      raceName: race.name,
      raceDistanceMiles: race.distanceMiles,
      raceTypeLabel: race.raceType,
      goalTime: plan.athlete_goal?.goalTime ?? null,
      currentWeeklyMileage: plan.currentWeeklyMileage ?? athlete.weeklyMileage,
      preferredDaysHuman: preferredDaysToHuman(preferredDays),
    });

    const updated = await prisma.training_plans.update({
      where: { id: plan.id },
      data: {
        phases: outline.phases as object,
        planWeeks: outline.planWeeks as object,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      planId: updated.id,
      phases: outline.phases,
      planWeeksCount: outline.planWeeks.length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Plan generation failed";
    console.error("POST /api/training-plan/generate", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
