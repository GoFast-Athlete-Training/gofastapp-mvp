export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { confirmAthleteFiveKPaceFromWorkout } from "@/lib/training/workout-pace-performance";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/training/workout/[id]/confirm-five-k-pace
 * Body: { suggestedFiveKSecPerMile: number }
 */
export async function POST(request: NextRequest, context: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id: workoutId } = await context.params;
    const body = (await request.json()) as { suggestedFiveKSecPerMile?: number };
    const suggested = body.suggestedFiveKSecPerMile;

    if (suggested == null || !Number.isFinite(suggested) || suggested <= 0) {
      return NextResponse.json(
        { error: "suggestedFiveKSecPerMile is required" },
        { status: 400 }
      );
    }

    const result = await confirmAthleteFiveKPaceFromWorkout({
      athleteId: auth.athlete.id,
      workoutId,
      suggestedFiveKSecPerMile: Math.round(suggested),
    });

    return NextResponse.json({ ok: result.applied, result });
  } catch (e: unknown) {
    console.error("POST confirm-five-k-pace", e);
    return NextResponse.json({ error: "Failed to confirm 5K pace update" }, { status: 500 });
  }
}
