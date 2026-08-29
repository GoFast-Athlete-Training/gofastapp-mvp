export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { recommendQualityCatalogueForPreset } from "@/lib/training/recommend-quality-ai-service";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/athlete-presets/[id]/recommend-quality
 * AI-pick catalogue IDs from persisted preset + athlete profile. Falls back to local scorer.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const wtRaw = typeof body.workoutType === "string" ? body.workoutType.trim() : "";
    if (wtRaw !== "Tempo" && wtRaw !== "Intervals") {
      return NextResponse.json(
        { error: "workoutType must be Tempo or Intervals" },
        { status: 400 }
      );
    }

    const templateSeedIds = Array.isArray(body.templateSeedIds)
      ? body.templateSeedIds.filter((x): x is string => typeof x === "string")
      : undefined;

    const result = await recommendQualityCatalogueForPreset({
      presetId: id,
      athleteId: auth.athlete.id,
      workoutType: wtRaw,
      templateSeedIds,
    });

    return NextResponse.json({
      catalogueIds: result.catalogueIds,
      source: result.source,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not recommend workouts";
    const status = msg.includes("not found") ? 404 : 500;
    console.error("POST /api/athlete-presets/[id]/recommend-quality", e);
    return NextResponse.json({ error: msg }, { status });
  }
}
