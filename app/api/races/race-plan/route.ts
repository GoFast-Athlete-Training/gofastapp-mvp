export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  getRacePlanForAthleteRace,
  upsertRacePlan,
  RacePlanError,
} from "@/lib/training/race-plan-service";
import { normalizeRacePlanDocument } from "@/lib/races/race-plan-builder";

/** GET — load race plan for an athlete_races row. */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const athleteRaceId = new URL(request.url).searchParams.get("athleteRaceId")?.trim();
    if (!athleteRaceId) {
      return NextResponse.json({ error: "athleteRaceId is required" }, { status: 400 });
    }

    const state = await getRacePlanForAthleteRace({
      athleteId: auth.athlete.id,
      athleteRaceId,
    });

    return NextResponse.json({
      racePlanId: state.racePlanId,
      planJson: state.planJson,
      pushedAt: state.pushedAt?.toISOString() ?? null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    console.error("GET /api/races/race-plan", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/** POST — save race plan document. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const athleteRaceId = typeof body.athleteRaceId === "string" ? body.athleteRaceId.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const planId = typeof body.planId === "string" ? body.planId.trim() : null;
    const raceDate = typeof body.raceDate === "string" ? body.raceDate.trim() : "";
    const planJson = normalizeRacePlanDocument(body.planJson);

    if (!athleteRaceId) {
      return NextResponse.json({ error: "athleteRaceId is required" }, { status: 400 });
    }

    const { racePlanId } = await upsertRacePlan({
      athleteId: auth.athlete.id,
      athleteRaceId,
      planId,
      title,
      raceDate: raceDate || new Date().toISOString(),
      planJson,
    });

    return NextResponse.json({ racePlanId });
  } catch (e: unknown) {
    const msg = e instanceof RacePlanError ? e.message : e instanceof Error ? e.message : "Failed";
    const status = msg.includes("not found") ? 404 : 400;
    console.error("POST /api/races/race-plan", e);
    return NextResponse.json({ error: msg }, { status });
  }
}
