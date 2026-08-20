export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { createRaceGoal, listAthleteRaceGoals } from "@/lib/athlete-race-goal";

async function athleteFromRequest(request: NextRequest) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return { error: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  }
  return { athlete: auth.athlete };
}

/** GET /api/goals — list race goals for authenticated athlete */
export async function GET(request: NextRequest) {
  try {
    const { athlete, error } = await athleteFromRequest(request);
    if (error) return error;

    const goals = await listAthleteRaceGoals(athlete!.id);
    return NextResponse.json({ goals });
  } catch (err: unknown) {
    console.error("GET /api/goals:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}

/** POST /api/goals — set goal on a claimed race */
export async function POST(request: NextRequest) {
  try {
    const { athlete, error } = await athleteFromRequest(request);
    if (error) return error;

    let body: {
      name?: string | null;
      description?: string | null;
      distance?: string;
      goalTime?: string | null;
      targetByDate?: string;
      raceRegistryId?: string | null;
      athleteRaceId?: string | null;
      status?: string;
      whyGoal?: string | null;
      successLooksLike?: string | null;
      completionFeeling?: string | null;
      motivationIcon?: string | null;
    } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body.athleteRaceId && !body.raceRegistryId) {
      return NextResponse.json(
        { error: "athleteRaceId or raceRegistryId is required" },
        { status: 400 }
      );
    }

    try {
      const goal = await createRaceGoal(athlete!.id, {
        name: body.name,
        description: body.description,
        distance: body.distance ?? "",
        goalTime: body.goalTime,
        raceRegistryId: body.raceRegistryId,
        athleteRaceId: body.athleteRaceId,
        whyGoal: body.whyGoal,
        successLooksLike: body.successLooksLike,
        completionFeeling: body.completionFeeling,
        motivationIcon: body.motivationIcon,
      });
      return NextResponse.json({ goal });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Create failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  } catch (err: unknown) {
    console.error("POST /api/goals:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}
