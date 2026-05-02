export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  attachMpSimAdvisory,
  computeRaceLoadGapAnalysis,
} from "@/lib/training/race-load-gap-analysis";

/**
 * GET /api/training/plan/race-readiness-gap?planId=&scheduledMpMiles=
 * Narrative readiness gaps from canonical workouts (including promoted runs).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const planId = searchParams.get("planId");
    const scheduledRaw = searchParams.get("scheduledMpMiles");

    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 });
    }

    let scheduledMp: number | null = null;
    if (scheduledRaw != null && scheduledRaw.trim() !== "") {
      const s = Number(scheduledRaw);
      if (Number.isFinite(s) && s > 0) scheduledMp = s;
    }

    const base = await computeRaceLoadGapAnalysis({
      athleteId: auth.athlete.id,
      planId,
    });

    const out = attachMpSimAdvisory(base, scheduledMp);

    return NextResponse.json({
      ok: true,
      analysis: out,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    const status = msg === "Plan not found" ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
