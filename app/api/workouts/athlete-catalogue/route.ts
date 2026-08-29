export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { createAthleteCatalogueWorkout } from "@/lib/training/athlete-catalogue-create";

/**
 * POST /api/workouts/athlete-catalogue
 * Athlete-authored Tempo/Intervals catalogue row (private to owner; not staff catalogue).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name : "";
    const description =
      body.description === null || body.description === undefined
        ? null
        : typeof body.description === "string"
          ? body.description
          : null;
    const wtRaw = typeof body.workoutType === "string" ? body.workoutType.trim() : "";
    if (wtRaw !== "Tempo" && wtRaw !== "Intervals") {
      return NextResponse.json(
        { error: "workoutType must be Tempo or Intervals" },
        { status: 400 }
      );
    }

    const item = await createAthleteCatalogueWorkout({
      athleteId: auth.athlete.id,
      name,
      description,
      workoutType: wtRaw,
    });

    return NextResponse.json({ item });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not create workout";
    const status = msg.includes("already have") ? 409 : 400;
    console.error("POST /api/workouts/athlete-catalogue", e);
    return NextResponse.json({ error: msg }, { status });
  }
}
