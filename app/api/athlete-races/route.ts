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

/** GET /api/athlete-races — my claimed athlete races (working set) */
export async function GET(request: NextRequest) {
  try {
    const { athlete, error } = await athleteFromRequest(request);
    if (error) return error;

    const [athleteRaces, activePlan] = await Promise.all([
      listAthleteRacesForAthlete(athlete!.id),
      findActiveTrainingPlanForAthlete(athlete!.id),
    ]);

    const hydrated = hydrateAthleteRacesWithTrainingPlan(athleteRaces, activePlan);

    return NextResponse.json({
      athleteRaces: hydrated,
      /** @deprecated compatibility alias — use athleteRaces */
      signups: hydrated,
    });
  } catch (err: unknown) {
    console.error("GET /api/athlete-races:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}

/** POST /api/athlete-races — body { raceRegistryId } — claim catalog race (idempotent) */
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
    console.error("POST /api/athlete-races:", err);
    return NextResponse.json(
      {
        error: "Server error",
        details: err instanceof Error ? err.message : "Unknown",
      },
      { status: 500 }
    );
  }
}
