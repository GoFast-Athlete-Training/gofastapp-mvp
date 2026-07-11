export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { loadShareHubStatus } from "@/lib/server/load-share-hub-status";

/** GET /api/me/share-hub-status — creator hub card statuses for the authenticated athlete */
export async function GET(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const status = await loadShareHubStatus(auth.athlete.id);
    return NextResponse.json({ success: true, status });
  } catch (err) {
    console.error("GET /api/me/share-hub-status:", err);
    return NextResponse.json({ error: "Failed to load share hub status" }, { status: 500 });
  }
}
