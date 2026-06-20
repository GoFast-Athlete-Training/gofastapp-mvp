export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { resolveClubInstanceLanes } from "@/lib/advance-club-instances";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    process.env.NEXT_PUBLIC_COMPANY_APP_URL || "https://gofasthq.gofastcrushgoals.com",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * GET /api/runs/resolve-instances?runClubId=...
 * Product-only resolver: next instance, history, and advance-needed per runSeriesId lane.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    try {
      await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401, headers: corsHeaders }
      );
    }

    const runClubId = new URL(request.url).searchParams.get("runClubId")?.trim();
    if (!runClubId) {
      return NextResponse.json(
        { success: false, error: "runClubId is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const lanes = await resolveClubInstanceLanes(runClubId);

    return NextResponse.json(
      {
        success: true,
        runClubId,
        lanes,
      },
      { headers: corsHeaders }
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[GET /api/runs/resolve-instances]", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to resolve instances" },
      { status: 500, headers: corsHeaders }
    );
  }
}
