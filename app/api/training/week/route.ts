export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { phaseForCatalogue } from "@/lib/training/generate-plan";

/**
 * GET /api/training/week?planId=&weekNumber=
 * Returns plan workouts for that week (no segments).
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
      select: { totalWeeks: true },
    });
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
    if (weekNumber > plan.totalWeeks) {
      return NextResponse.json(
        { error: `weekNumber must be <= ${plan.totalWeeks}` },
        { status: 400 }
      );
    }

    const workouts = await prisma.workouts.findMany({
      where: {
        planId,
        athleteId: auth.athlete.id,
        weekNumber,
      },
      orderBy: { date: "asc" },
    });

    const nOffset = weekNumber - plan.totalWeeks;
    const cards = workouts.map((w) => ({
      id: w.id,
      title: w.title,
      workoutType: w.workoutType,
      date: w.date,
      phase: w.phase ?? phaseForCatalogue(w.nOffset ?? nOffset),
      estimatedDistanceInMeters: w.estimatedDistanceInMeters,
      matchedActivityId: w.matchedActivityId,
      actualDistanceMeters: w.actualDistanceMeters,
      actualAvgPaceSecPerMile: w.actualAvgPaceSecPerMile,
      actualAverageHeartRate: w.actualAverageHeartRate,
      actualDurationSeconds: w.actualDurationSeconds,
    }));

    return NextResponse.json({ weekNumber, workouts: cards });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load week";
    console.error("GET /api/training/week", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
