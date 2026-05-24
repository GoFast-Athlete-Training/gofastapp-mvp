export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { loadRaceInfoPacketsForAthlete } from "@/lib/races/load-race-info-packets";

/** GET /api/race-registry/[id]/info-packets — time-aware race info slices for any client. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    if (!id?.trim()) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const result = await loadRaceInfoPacketsForAthlete(id.trim(), auth.athlete.id);
    if (!result) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (e: unknown) {
    console.error("GET /api/race-registry/[id]/info-packets", e);
    return NextResponse.json(
      { error: "Server error", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 }
    );
  }
}
