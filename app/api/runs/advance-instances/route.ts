export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { advanceClubInstances } from "@/lib/advance-club-instances";
import { CLUB_RUN_AUTO_ADVANCE_DISABLED_MESSAGE } from "@/lib/club-run-auto-advance";

const corsHeaders = {
  "Access-Control-Allow-Origin":
    process.env.NEXT_PUBLIC_COMPANY_APP_URL || "https://gofasthq.gofastcrushgoals.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

type Body = {
  runClubId?: string;
  staffGeneratedId?: string;
  runSeriesIds?: string[];
};

/**
 * POST /api/runs/advance-instances
 * Product-only find-or-create: fill the next 2 weekly occurrence slots per runSeriesId lane (live by default).
 */
export async function POST(request: NextRequest) {
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

    const body = (await request.json().catch(() => ({}))) as Body;
    const runClubId = body.runClubId?.trim();
    if (!runClubId) {
      return NextResponse.json(
        { success: false, error: "runClubId is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const advance = await advanceClubInstances({
      runClubId,
      staffGeneratedId: body.staffGeneratedId,
      runSeriesIds: body.runSeriesIds,
    });

    if (advance.skipped) {
      return NextResponse.json(
        {
          success: true,
          skipped: true,
          autoAdvanceDisabled: true,
          message: CLUB_RUN_AUTO_ADVANCE_DISABLED_MESSAGE,
          runClubId,
          created: 0,
          found: 0,
          errorCount: 0,
          results: [],
        },
        { headers: corsHeaders }
      );
    }

    const results = advance.results;
    const created = results.filter((r) => r.outcome === "created").length;
    const found = results.filter((r) => r.outcome === "found_existing").length;
    const errors = results.filter((r) => r.outcome === "error").length;

    return NextResponse.json(
      {
        success: errors === 0,
        runClubId,
        created,
        found,
        skipped: results.filter((r) => r.outcome === "skipped_no_prior").length,
        errorCount: errors,
        results,
      },
      { headers: corsHeaders }
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[POST /api/runs/advance-instances]", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to advance instances" },
      { status: 500, headers: corsHeaders }
    );
  }
}
