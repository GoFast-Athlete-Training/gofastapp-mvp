export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { getJoinableCohortForHost } from "@/lib/training/cohort-service";

/** GET /api/training-cohorts/mine — host's open/active group training cohort */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const cohort = await getJoinableCohortForHost(auth.athlete.id);
    return NextResponse.json({ success: true, cohort });
  } catch (e) {
    console.error("GET /api/training-cohorts/mine:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
