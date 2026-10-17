import { NextRequest, NextResponse } from "next/server";
import { assertRunManageAuth } from "@/lib/runmanage/require-run-manage-auth";
import { purgeUnclaimedClubRuns } from "@/lib/runmanage/purge-unclaimed-runs";

export const dynamic = "force-dynamic";

/**
 * POST /api/runmanage/runs/purge-unclaimed
 * Body: { confirm?: "PURGE_UNCLAIMED_RUNS", dryRun?: boolean, runClubId?: string }
 */
export async function POST(request: NextRequest) {
  const auth = await assertRunManageAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    confirm?: string;
    dryRun?: boolean;
    runClubId?: string;
  };

  if (body.confirm !== "PURGE_UNCLAIMED_RUNS") {
    return NextResponse.json(
      {
        success: false,
        error: 'Send { "confirm": "PURGE_UNCLAIMED_RUNS" } to delete unclaimed draft club runs.',
      },
      { status: 400 }
    );
  }

  try {
    const result = await purgeUnclaimedClubRuns({
      runClubId: body.runClubId?.trim() || null,
      dryRun: body.dryRun === true,
    });
    return NextResponse.json({
      success: true,
      dryRun: body.dryRun === true,
      ...result,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[POST /api/runmanage/runs/purge-unclaimed]", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Purge failed" },
      { status: 500 }
    );
  }
}
