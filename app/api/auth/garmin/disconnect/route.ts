export const dynamic = "force-dynamic";

/**
 * POST /api/auth/garmin/disconnect
 *
 * Notifies Garmin and clears stored Garmin tokens / profile fields for the signed-in athlete.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { disconnectGarmin } from "@/lib/domain-garmin";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    await disconnectGarmin(auth.athlete.id);
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Disconnect failed";
    console.error("POST /api/auth/garmin/disconnect", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
