export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { prisma } from "@/lib/prisma";
import { previewRaceImpactOnPlan } from "@/lib/training/plan-race-impact";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/training-plan/[id]/race-impact?raceRegistryId= */
export async function GET(request: NextRequest, context: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await context.params;
    const raceRegistryId = request.nextUrl.searchParams.get("raceRegistryId")?.trim();
    if (!raceRegistryId) {
      return NextResponse.json({ error: "raceRegistryId is required" }, { status: 400 });
    }

    const plan = await prisma.training_plans.findFirst({
      where: { id, athleteId: auth.athlete.id },
    });
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const race = await prisma.race_registry.findFirst({
      where: { id: raceRegistryId },
      select: {
        id: true,
        name: true,
        raceDate: true,
        distanceMeters: true,
      },
    });
    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    const preview = previewRaceImpactOnPlan({
      planId: plan.id,
      planStart: plan.startDate,
      totalWeeks: plan.totalWeeks,
      planSchedule: plan.planSchedule,
      event: {
        raceRegistryId: race.id,
        raceName: race.name,
        raceDate: race.raceDate,
        distanceMeters: race.distanceMeters,
      },
    });

    return NextResponse.json({ preview });
  } catch (e: unknown) {
    console.error("GET /api/training-plan/[id]/race-impact", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to preview race impact" },
      { status: 500 }
    );
  }
}
