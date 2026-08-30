export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { confirmWhereYouStand } from "@/lib/training/where-you-stand";

type Body = {
  planId?: string | null;
  weekNumber?: number | null;
  fiveKPaceSecPerMile?: number | null;
  thresholdPaceSecPerMile?: number | null;
  longRunCapabilityMiles?: number | null;
  longRunCapabilityPaceSecPerMile?: number | null;
  sourceWorkoutId?: string | null;
};

/**
 * POST /api/performance/confirm-stand
 * Athlete confirms (or edits) Where you stand numbers.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await request.json()) as Body;
    const result = await confirmWhereYouStand({
      athleteId: auth.athlete.id,
      planId: body.planId ?? null,
      weekNumber: body.weekNumber ?? null,
      fiveKPaceSecPerMile: body.fiveKPaceSecPerMile ?? null,
      thresholdPaceSecPerMile: body.thresholdPaceSecPerMile ?? null,
      longRunCapabilityMiles: body.longRunCapabilityMiles ?? null,
      longRunCapabilityPaceSecPerMile: body.longRunCapabilityPaceSecPerMile ?? null,
      sourceWorkoutId: body.sourceWorkoutId ?? null,
    });

    return NextResponse.json({ ok: result.ok, result });
  } catch (e: unknown) {
    console.error("POST /api/performance/confirm-stand", e);
    return NextResponse.json({ error: "Failed to confirm stand" }, { status: 500 });
  }
}
