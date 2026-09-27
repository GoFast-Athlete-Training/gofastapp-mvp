export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { prisma } from "@/lib/prisma";
import {
  getRacePlanForAthleteRace,
  upsertRacePlan,
  RacePlanError,
} from "@/lib/training/race-plan-service";
import { normalizeRacePlanDocument } from "@/lib/races/race-plan-builder";
import { RaceDayPlanError } from "@/lib/training/save-race-day-planned-workout";

/** GET — race plan for plan race day (resolves athleteRaceId from training plan). */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("planId")?.trim();
    const date = searchParams.get("date")?.trim();
    if (!planId || !date) {
      return NextResponse.json({ error: "planId and date are required" }, { status: 400 });
    }

    const plan = await prisma.training_plans.findFirst({
      where: { id: planId, athleteId: auth.athlete.id },
      select: { athleteRaceId: true },
    });
    if (!plan?.athleteRaceId) {
      return NextResponse.json({ error: "Plan has no linked athlete race" }, { status: 404 });
    }

    const state = await getRacePlanForAthleteRace({
      athleteId: auth.athlete.id,
      athleteRaceId: plan.athleteRaceId,
    });

    return NextResponse.json({
      racePlanId: state.racePlanId,
      planJson: state.planJson,
      pushedAt: state.pushedAt?.toISOString() ?? null,
      athleteRaceId: plan.athleteRaceId,
      date,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    console.error("GET /api/training/race-day", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/** POST — save race plan (legacy path; prefer POST /api/races/race-plan). */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const planId = typeof body.planId === "string" ? body.planId.trim() : "";
    const date = typeof body.date === "string" ? body.date.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const planJson = body.planJson
      ? normalizeRacePlanDocument(body.planJson)
      : null;

    if (!planId || !date) {
      return NextResponse.json({ error: "planId and date are required" }, { status: 400 });
    }

    const plan = await prisma.training_plans.findFirst({
      where: { id: planId, athleteId: auth.athlete.id },
      select: { athleteRaceId: true },
    });
    if (!plan?.athleteRaceId) {
      throw new RaceDayPlanError("Plan has no linked athlete race");
    }

    if (!planJson) {
      return NextResponse.json({ error: "planJson is required" }, { status: 400 });
    }

    const { racePlanId } = await upsertRacePlan({
      athleteId: auth.athlete.id,
      athleteRaceId: plan.athleteRaceId,
      planId,
      title,
      raceDate: date,
      planJson,
    });

    return NextResponse.json({ racePlanId, plannedWorkoutId: racePlanId, workoutId: racePlanId });
  } catch (e: unknown) {
    const msg =
      e instanceof RacePlanError || e instanceof RaceDayPlanError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Failed";
    const status = msg.includes("not found") || msg.includes("not a race") ? 404 : 400;
    console.error("POST /api/training/race-day", e);
    return NextResponse.json({ error: msg }, { status });
  }
}
