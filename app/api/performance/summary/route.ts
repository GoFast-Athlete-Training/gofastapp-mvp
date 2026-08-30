export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { loadPerformanceSummary } from "@/lib/training/performance-summary";

/**
 * GET /api/performance/summary
 * Active plan week rollup + current 5K + pending 5K confirmations.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const summary = await loadPerformanceSummary(auth.athlete.id);
    return NextResponse.json(summary);
  } catch (e: unknown) {
    console.error("GET /api/performance/summary:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load performance summary" },
      { status: 500 }
    );
  }
}
