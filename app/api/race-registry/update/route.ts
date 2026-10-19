import { upsertRaceRegistryFromPayload } from "@/lib/races/upsert-race-registry-from-payload";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    process.env.NEXT_PUBLIC_COMPANY_APP_URL ||
    "https://gofasthq.gofastcrushgoals.com",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * POST /api/race-registry/update
 * Legacy Company prodpush + coachplatform stub. Race Manage uses internal route.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const racePayload = (body as { race?: Record<string, unknown> }).race;
  if (!racePayload) {
    return NextResponse.json(
      { success: false, error: "race payload is required" },
      { status: 400, headers: corsHeaders }
    );
  }

  const result = await upsertRaceRegistryFromPayload(racePayload);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status, headers: corsHeaders }
    );
  }

  const response = NextResponse.json({
    success: true,
    race: result.race,
    registryMirror: result.registryMirror,
  });
  Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}
