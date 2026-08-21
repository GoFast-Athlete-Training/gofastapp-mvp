/** GET /api/race-calendar — athlete-owned race calendar from athlete_races */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { loadHydratedRaceCalendar } from "@/lib/training/race-calendar-hydrate";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const calendar = await loadHydratedRaceCalendar(auth.athlete.id);
    return NextResponse.json({ success: true, calendar });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load race calendar";
    console.error("GET /api/race-calendar", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
