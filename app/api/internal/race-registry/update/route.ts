export const dynamic = "force-dynamic";

import { verifyInternalApiKey } from "@/lib/internal-api-auth";
import { upsertRaceRegistryFromPayload } from "@/lib/races/upsert-race-registry-from-payload";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/internal/race-registry/update
 * Machine lane — Race Manage prod push (GOFAST_INTERNAL_API_KEY).
 */
export async function POST(request: NextRequest) {
  const authError = verifyInternalApiKey(request);
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  const racePayload = (body as { race?: Record<string, unknown> }).race;
  if (!racePayload) {
    return NextResponse.json(
      { success: false, error: "race payload is required" },
      { status: 400 }
    );
  }

  const result = await upsertRaceRegistryFromPayload(racePayload);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status }
    );
  }

  return NextResponse.json({
    success: true,
    race: result.race,
    registryMirror: result.registryMirror,
  });
}
