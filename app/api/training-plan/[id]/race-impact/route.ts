export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { prisma } from "@/lib/prisma";
import { previewPlanRaceCollision } from "@/lib/training/race-plan-calendar-service";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/training-plan/[id]/race-impact?raceRegistryId= | athleteRaceId= */
export async function GET(request: NextRequest, context: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await context.params;
    const raceRegistryId = request.nextUrl.searchParams.get("raceRegistryId")?.trim();
    const athleteRaceIdParam = request.nextUrl.searchParams.get("athleteRaceId")?.trim();

    const plan = await prisma.training_plans.findFirst({
      where: { id, athleteId: auth.athlete.id },
    });
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const athleteRace = athleteRaceIdParam
      ? await prisma.athlete_races.findFirst({
          where: { id: athleteRaceIdParam, athleteId: auth.athlete.id },
        })
      : raceRegistryId
        ? await prisma.athlete_races.findUnique({
            where: {
              athleteId_raceRegistryId: {
                athleteId: auth.athlete.id,
                raceRegistryId,
              },
            },
          })
        : null;

    if (!athleteRace) {
      return NextResponse.json(
        { error: "athleteRaceId or raceRegistryId is required" },
        { status: 400 }
      );
    }

    const preview = previewPlanRaceCollision({
      planId: plan.id,
      planStart: plan.startDate,
      totalWeeks: plan.totalWeeks,
      planSchedule: plan.planSchedule,
      entry: {
        athleteRaceId: athleteRace.id,
        raceRegistryId: athleteRace.raceRegistryId,
        raceName: athleteRace.name,
        raceDate: athleteRace.raceDate,
        distanceMeters: athleteRace.distanceMeters,
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
