export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { prisma } from "@/lib/prisma";
import { listSecondaryCandidatesForPlan } from "@/lib/training/race-plan-calendar-service";
import { parseAthleteRaceMainSnap } from "@/lib/training/plan-race-snapshots";

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
        athlete_race: true,
      },
    });
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const mainSnap = parseAthleteRaceMainSnap(plan.athleteRaceMainSnap);
    const terminalDate =
      plan.athlete_race?.raceDate ??
      (mainSnap ? new Date(mainSnap.raceDate) : null);
    if (!terminalDate) {
      return NextResponse.json({ error: "Plan has no terminal race date" }, { status: 404 });
    }

    const rawCandidates = await listSecondaryCandidatesForPlan({
      athleteId: auth.athlete.id,
      planStart: plan.startDate,
      terminalRaceDate: terminalDate,
      athleteRaceId: plan.athleteRaceId,
    });

    const candidates = rawCandidates.map((ar) => ({
      athleteRaceId: ar.id,
      raceRegistryId: ar.raceRegistryId,
      race: {
        name: ar.name,
        raceDate: ar.raceDate.toISOString(),
        distanceLabel: ar.distanceLabel,
      },
    }));

    return NextResponse.json({ candidates });
  } catch (e: unknown) {
    console.error("GET /api/training-plan/[id]/race-events", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load plan race events" },
      { status: 500 }
    );
  }
}
