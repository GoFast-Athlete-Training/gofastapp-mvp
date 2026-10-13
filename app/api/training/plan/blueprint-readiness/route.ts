export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { computeBlueprintReadiness } from "@/lib/training/blueprint-readiness";

/**
 * GET /api/training/plan/blueprint-readiness?planId=
 * Same preset loaders as generate — for athlete setup confirmation before first generate.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const planId = request.nextUrl.searchParams.get("planId")?.trim() ?? "";
    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 });
    }

    const readiness = await computeBlueprintReadiness({
      athleteId: auth.athlete.id,
      planId,
    });
    if (!readiness) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    return NextResponse.json(readiness);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "blueprint-readiness failed";
    console.error("GET /api/training/plan/blueprint-readiness", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
