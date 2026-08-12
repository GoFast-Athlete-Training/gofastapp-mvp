export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { prisma } from "@/lib/prisma";
import {
  listSecondaryCandidatesForPlan,
  loadPlanRaceEvents,
  signupAffectsActivePlan,
  syncPlanRaceEventsFromCalendar,
} from "@/lib/training/plan-race-events";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/training-plan/[id]/race-events */
export async function GET(_request: NextRequest, context: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(_request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await context.params;
    const plan = await prisma.training_plans.findFirst({
      where: { id, athleteId: auth.athlete.id },
      include: { race_registry: { select: { raceDate: true } } },
    });
    if (!plan?.race_registry) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const [events, candidates] = await Promise.all([
      loadPlanRaceEvents(id),
      listSecondaryCandidatesForPlan({
        athleteId: auth.athlete.id,
        planStart: plan.startDate,
        primaryRaceDate: plan.race_registry.raceDate,
      }),
    ]);

    return NextResponse.json({ events, candidates });
  } catch (e: unknown) {
    console.error("GET /api/training-plan/[id]/race-events", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load plan race events" },
      { status: 500 }
    );
  }
}

/** POST /api/training-plan/[id]/race-events — sync calendar into plan events */
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

    let body: { includedSecondarySignupIds?: string[] } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const events = await syncPlanRaceEventsFromCalendar({
      trainingPlanId: id,
      athleteId: auth.athlete.id,
      includedSecondarySignupIds: Array.isArray(body.includedSecondarySignupIds)
        ? body.includedSecondarySignupIds
        : null,
    });

    return NextResponse.json({ success: true, events });
  } catch (e: unknown) {
    console.error("POST /api/training-plan/[id]/race-events", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to sync plan race events" },
      { status: 500 }
    );
  }
}
