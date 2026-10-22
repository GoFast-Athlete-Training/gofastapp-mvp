export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { assertRunManageAuth } from "@/lib/runmanage/require-run-manage-auth";
import { generateRouteDetails } from "@/lib/services/route-details-service";

function str(v: unknown): string {
  return v != null ? String(v).trim() : "";
}

/**
 * POST /api/runs/route-details-generate
 * Route path prose from map and/or pasted directions — prod athlete app + run manage staff.
 */
export async function POST(request: NextRequest) {
  const athleteAuth = await requireAthleteFromBearer(request);
  if ("error" in athleteAuth) {
    const staffAuth = await assertRunManageAuth(request);
    if (staffAuth instanceof NextResponse) {
      return NextResponse.json(
        { success: false, error: athleteAuth.error },
        { status: athleteAuth.status },
      );
    }
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const result = await generateRouteDetails({
    mapImageUrl: str(body.mapImageUrl) || null,
    directionsText: str(body.directionsText) || null,
    routeNotes: str(body.routeNotes) || null,
    routeNeighborhood: str(body.routeNeighborhood) || null,
    stravaMapUrl: str(body.stravaMapUrl) || null,
    totalMiles:
      typeof body.totalMiles === "string" || typeof body.totalMiles === "number"
        ? body.totalMiles
        : null,
    meetUpPoint: str(body.meetUpPoint) || null,
  });

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    routeNotes: result.routeNotes,
  });
}
