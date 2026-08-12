export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { prisma } from "@/lib/prisma";
import { listSecondaryCandidatesForPlan } from "@/lib/training/race-plan-calendar-service";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/training-plan/[id]/race-events — secondary bolt-on candidates */
export async function GET(_request: NextRequest, context: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(_request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await context.params;
    const plan = await prisma.training_plans.findFirst({
      where: { id, athleteId: auth.athlete.id },
      include: {
        primary_athlete_race: true,
        race_registry: { select: { raceDate: true } },
      },
    });
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const primaryDate =
      plan.primary_athlete_race?.raceDate ?? plan.race_registry?.raceDate ?? null;
    if (!primaryDate) {
      return NextResponse.json({ error: "Plan has no terminal race date" }, { status: 404 });
    }

    const rawCandidates = await listSecondaryCandidatesForPlan({
      athleteId: auth.athlete.id,
      planStart: plan.startDate,
      primaryRaceDate: primaryDate,
      primaryAthleteRaceId: plan.primaryAthleteRaceId,
    });

    const candidates = rawCandidates.map((ar) => ({
      athleteRaceId: ar.id,
      signupId: ar.id,
      raceRegistryId: ar.raceRegistryId,
      race: {
        name: ar.name,
        raceDate: ar.raceDate.toISOString(),
        distanceLabel: ar.distanceLabel,
      },
    }));

    return NextResponse.json({ events: [], candidates });
  } catch (e: unknown) {
    console.error("GET /api/training-plan/[id]/race-events", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load plan race events" },
      { status: 500 }
    );
  }
}

/** POST /api/training-plan/[id]/race-events — persist included secondary selection (no-op sync; imprint at generate) */
export async function POST(request: NextRequest, context: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await context.params;
    const plan = await prisma.training_plans.findFirst({
      where: { id, athleteId: auth.athlete.id },
    });
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, events: [] });
  } catch (e: unknown) {
    console.error("POST /api/training-plan/[id]/race-events", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to sync plan race events" },
      { status: 500 }
    );
  }
}
