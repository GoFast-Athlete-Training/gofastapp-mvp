export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { buildPlanWeekCards } from "@/lib/training/plan-week-cards";
import { effectiveTrainingWeekCount } from "@/lib/training/plan-utils";

/**
 * GET /api/training/week?planId=&weekNumber=
 * @deprecated Prefer GET /api/training/plan/week (identical response).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("planId");
    const weekParam = searchParams.get("weekNumber");

    if (!planId || !weekParam) {
      return NextResponse.json(
        { error: "planId and weekNumber are required" },
        { status: 400 }
      );
    }

    const weekNumber = parseInt(weekParam, 10);
    if (!Number.isFinite(weekNumber) || weekNumber < 1) {
      return NextResponse.json({ error: "Invalid weekNumber" }, { status: 400 });
    }

    const plan = await prisma.training_plans.findFirst({
      where: { id: planId, athleteId: auth.athlete.id },
      include: {
        race_registry: {
          select: { raceDate: true, name: true, distanceMiles: true },
        },
      },
    });
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
    const race = plan.race_registry;
    const effectiveWeeks = effectiveTrainingWeekCount(
      plan.startDate,
      plan.totalWeeks,
      race?.raceDate ?? null
    );
    if (weekNumber > effectiveWeeks) {
      return NextResponse.json(
        { error: `weekNumber must be <= ${effectiveWeeks}` },
        { status: 400 }
      );
    }

    const days = await buildPlanWeekCards({
      planId: plan.id,
      athleteId: auth.athlete.id,
      planStartDate: plan.startDate,
      planWeeks: plan.planWeeks,
      weekNumber,
      storedTotalWeeks: plan.totalWeeks,
      raceDate: race?.raceDate ?? null,
      raceName: race?.name ?? null,
      raceDistanceMiles: race?.distanceMiles ?? null,
    });

    return NextResponse.json({ weekNumber, days });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load week";
    console.error("GET /api/training/week", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
