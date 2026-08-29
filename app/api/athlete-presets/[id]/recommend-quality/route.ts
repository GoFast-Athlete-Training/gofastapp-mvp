export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { recommendQualityCatalogueForPreset } from "@/lib/training/recommend-quality-ai-service";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/athlete-presets/[id]/recommend-quality
 * AI creates 3–4 new athlete-owned catalogue workouts complementing existing staff catalogue.
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

    const result = await recommendQualityCatalogueForPreset({
      presetId: id,
      athleteId: auth.athlete.id,
      workoutType: wtRaw,
    });

    return NextResponse.json({
      created: result.created,
      source: result.source,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not recommend workouts";
    const status = msg.includes("not found") ? 404 : 500;
    console.error("POST /api/athlete-presets/[id]/recommend-quality", e);
    return NextResponse.json({ error: msg }, { status });
  }
}
