import { NextRequest, NextResponse } from "next/server";
import { assertRunManageAuth } from "@/lib/runmanage/require-run-manage-auth";
import { buildWeekBoardSeriesList } from "@/lib/runmanage/series-operational-list";
import { listRegionCityOptions } from "@/lib/runmanage/week-board-filters";

export const dynamic = "force-dynamic";

/**
 * GET /api/runmanage/run-series?region=&city=&weekOffset=&runClubId=
 * Week-scoped operational board (region + city required for series rows).
 */
export async function GET(request: NextRequest) {
  const auth = await assertRunManageAuth(request);
  if (auth instanceof NextResponse) return auth;

  const params = request.nextUrl.searchParams;
  const regionSlug = params.get("region")?.trim() || params.get("regionSlug")?.trim() || "";
  const citySlug = params.get("city")?.trim() || params.get("citySlug")?.trim() || "";
  const runClubId = params.get("runClubId")?.trim() || params.get("clubId")?.trim() || null;
  const weekOffsetRaw = params.get("weekOffset");
  const weekOffset = weekOffsetRaw != null ? parseInt(weekOffsetRaw, 10) : 0;

  const filterOptions = await listRegionCityOptions();

  if (!regionSlug || !citySlug) {
    return NextResponse.json({
      success: true,
      needsFilters: true,
      filterOptions,
      window: null,
      series: [],
    });
  }

  try {
    const { window, series } = await buildWeekBoardSeriesList({
      regionSlug,
      citySlug,
      weekOffset: Number.isFinite(weekOffset) ? weekOffset : 0,
      runClubId,
    });
    return NextResponse.json({
      success: true,
      needsFilters: false,
      filterOptions,
      window,
      series,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[GET /api/runmanage/run-series]", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to load run series" },
      { status: 500 }
    );
  }
}
