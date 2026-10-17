import { NextRequest, NextResponse } from "next/server";
import { assertRunManageAuth } from "@/lib/runmanage/require-run-manage-auth";
import { buildOperationalSeriesList } from "@/lib/runmanage/series-operational-list";

export const dynamic = "force-dynamic";

/**
 * GET /api/runmanage/run-series
 * Flat operational list — every run_series with stoplight and next dated run.
 */
export async function GET(request: NextRequest) {
  const auth = await assertRunManageAuth(request);
  if (auth instanceof NextResponse) return auth;

  const runClubId = request.nextUrl.searchParams.get("runClubId")?.trim() || null;

  try {
    const series = await buildOperationalSeriesList({ runClubId });
    return NextResponse.json({ success: true, series });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[GET /api/runmanage/run-series]", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to load run series" },
      { status: 500 }
    );
  }
}
