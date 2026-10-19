import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { STAFF_ID_HEADER } from "@/lib/staff-forward-auth";
import { upsertRaceRegistryFromPayload } from "@/lib/races/upsert-race-registry-from-payload";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    process.env.NEXT_PUBLIC_COMPANY_APP_URL ||
    "https://gofasthq.gofastcrushgoals.com",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": `Content-Type, Authorization, ${STAFF_ID_HEADER}`,
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * POST /api/race-registry/update
 * Race Manage staff lane — Firebase Bearer + x-gofast-staff-id (race manager id).
 */
export async function POST(request: NextRequest) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) {
    Object.entries(corsHeaders).forEach(([k, v]) => authError.headers.set(k, v));
    return authError;
  }

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
