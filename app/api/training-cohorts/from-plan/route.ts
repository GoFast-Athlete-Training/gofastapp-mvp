export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { createCohortFromHostPlan } from "@/lib/training/cohort-service";

/** POST /api/training-cohorts/from-plan — host opens group training from active plan */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    let body: { description?: string; open?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      /* empty ok */
    }

    const result = await createCohortFromHostPlan(auth.athlete.id, {
      description: body.description,
      open: body.open,
    });

    return NextResponse.json({
      success: true,
      cohort: result.cohort,
      joinPath: result.joinPath,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create training group";
    console.error("POST /api/training-cohorts/from-plan:", e);
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
