export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { updateRaceResultReflection } from "@/lib/race-result-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { athlete } = auth;
  const { id: resultId } = await context.params;
  if (!resultId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  let body: {
    reflection?: string | null;
    notes?: string | null;
    howFeltRating?: number | null;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const result = await updateRaceResultReflection(athlete.id, resultId, {
      reflection: body.reflection,
      notes: body.notes,
      howFeltRating: body.howFeltRating,
    });
    return NextResponse.json({ result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    if (msg === "Result not found") {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    console.error("PUT /api/race-results/[id]:", err);
    return NextResponse.json({ error: "Server error", details: msg }, { status: 500 });
  }
}
