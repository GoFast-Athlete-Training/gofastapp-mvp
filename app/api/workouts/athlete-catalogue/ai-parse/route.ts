export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { parseCatalogueDescriptionWithAi } from "@/lib/training/catalogue-ai-parse";

/**
 * POST /api/workouts/athlete-catalogue/ai-parse
 * Athlete-auth'd staff-style catalogue parse — preview structure before save.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    void auth;

    const body = (await request.json()) as Record<string, unknown>;
    const description = typeof body.description === "string" ? body.description : "";
    const wtRaw = typeof body.workoutType === "string" ? body.workoutType.trim() : "";
    if (wtRaw !== "Tempo" && wtRaw !== "Intervals") {
      return NextResponse.json(
        { error: "workoutType must be Tempo or Intervals" },
        { status: 400 }
      );
    }

    const fields = await parseCatalogueDescriptionWithAi(description, {
      forceWorkoutType: wtRaw,
    });

    return NextResponse.json({ success: true, fields });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to parse workout description";
    console.error("POST /api/workouts/athlete-catalogue/ai-parse", e);
    return NextResponse.json(
      { success: false, error: "Failed to parse workout description", details: msg },
      { status: 500 }
    );
  }
}
