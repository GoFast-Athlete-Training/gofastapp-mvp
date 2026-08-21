export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  claimAthleteRaceWithSideEffects,
  isRaceNotFoundError,
  listAthleteRacesForAthlete,
  serializeAthleteRaceClaimResponse,
} from "@/lib/athlete-race-claim";
import {
  findActiveTrainingPlanForAthlete,
  hydrateAthleteRacesWithTrainingPlan,
} from "@/lib/athlete-primary-race";

async function athleteFromRequest(request: NextRequest) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return { error: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  }
  return { athlete: auth.athlete };
}

/** GET /api/race-signups — @deprecated alias for GET /api/athlete-races */
export async function GET(request: NextRequest) {
  try {
    const { athlete, error } = await athleteFromRequest(request);
    if (error) return error;

    const [athleteRaces, activePlan] = await Promise.all([
      listAthleteRacesForAthlete(athlete!.id),
      findActiveTrainingPlanForAthlete(athlete!.id),
    ]);
    const hydrated = hydrateAthleteRacesWithTrainingPlan(athleteRaces, activePlan);

    return NextResponse.json({ signups: hydrated, athleteRaces: hydrated });
  } catch (err: unknown) {
    console.error("GET /api/race-signups:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}

/** POST /api/race-signups — @deprecated alias for POST /api/athlete-races */
export async function POST(request: NextRequest) {
  try {
    const { athlete, error } = await athleteFromRequest(request);
    if (error) return error;

    const body = await request.json().catch(() => ({}));
    const raceRegistryId =
      typeof body.raceRegistryId === "string" ? body.raceRegistryId.trim() : "";

    if (!raceRegistryId) {
      return NextResponse.json({ error: "raceRegistryId required" }, { status: 400 });
    }

    const result = await claimAthleteRaceWithSideEffects({
      athleteId: athlete!.id,
      raceRegistryId,
    });

    return NextResponse.json(serializeAthleteRaceClaimResponse(result));
  } catch (err: unknown) {
    if (isRaceNotFoundError(err)) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }
    console.error("POST /api/race-signups:", err);
    return NextResponse.json(
      {
        error: "Server error",
        details: err instanceof Error ? err.message : "Unknown",
      },
      { status: 500 }
    );
  }
}
