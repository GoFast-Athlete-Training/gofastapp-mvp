export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { syncAthleteProfileSnapshot } from "@/lib/athlete-profile-snapshot";
import { claimAthleteRace, listAthleteRaces } from "@/lib/athlete-races-service";
import { upsertRaceMembershipFromSignup } from "@/lib/race-container-membership";
import {
  athleteRaceAffectsActivePlan,
  findActivePlanForAthlete,
  previewPlanRaceCollision,
} from "@/lib/training/race-plan-calendar-service";

async function athleteFromRequest(request: NextRequest) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return { error: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  }
  return { athlete: auth.athlete };
}

/** GET /api/race-signups — my claimed athlete races (snapshot working set) */
export async function GET(request: NextRequest) {
  try {
    const { athlete, error } = await athleteFromRequest(request);
    if (error) return error;

    const signups = await listAthleteRaces(athlete!.id);

    return NextResponse.json({ signups, athleteRaces: signups });
  } catch (err: unknown) {
    console.error("GET /api/race-signups:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}

/** POST /api/race-signups — body { raceRegistryId } — claim catalog race */
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

    const athleteRace = await claimAthleteRace({
      athleteId: athlete!.id,
      raceRegistryId,
    });

    await upsertRaceMembershipFromSignup(athlete!.id, raceRegistryId);
    await syncAthleteProfileSnapshot(athlete!.id);

    const planImpact = await athleteRaceAffectsActivePlan({
      athleteId: athlete!.id,
      athleteRaceId: athleteRace.id,
      raceDate: athleteRace.raceDate,
    });

    let impactPreview = null;
    if (planImpact.affectsPlan && planImpact.planId) {
      const activePlan = await findActivePlanForAthlete(athlete!.id);
      if (activePlan?.planSchedule) {
        impactPreview = previewPlanRaceCollision({
          planId: planImpact.planId,
          planStart: activePlan.startDate,
          totalWeeks: activePlan.totalWeeks,
          planSchedule: activePlan.planSchedule,
          entry: {
            athleteRaceId: athleteRace.id,
            raceRegistryId: athleteRace.raceRegistryId,
            raceName: athleteRace.name,
            raceDate: athleteRace.raceDate,
            distanceMeters: athleteRace.distanceMeters,
          },
        });
      }
    }

    return NextResponse.json({
      signup: athleteRace,
      athleteRace,
      planImpact,
      impactPreview,
    });
  } catch (err: unknown) {
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
