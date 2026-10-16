export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { listAthleteHostedRunInvites } from "@/lib/city-run/list-athlete-hosted-invites";

/**
 * GET /api/me/hosted-run-invites
 * Recent run invites this athlete created (newest first) with share URLs.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit =
    limitParam != null && limitParam !== ""
      ? Number.parseInt(limitParam, 10)
      : undefined;

  try {
    const invites = await listAthleteHostedRunInvites(auth.athlete.id, {
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    return NextResponse.json({ success: true, invites });
  } catch (err) {
    console.error("GET /api/me/hosted-run-invites:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
