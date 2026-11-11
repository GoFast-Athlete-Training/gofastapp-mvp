import { NextRequest, NextResponse } from "next/server";
import { assertRunManageAuth } from "@/lib/runmanage/require-run-manage-auth";
import {
  buildWeekBoardSeriesList,
  buildWeekQueueSeriesList,
} from "@/lib/runmanage/series-operational-list";
import { listRegionCityOptions } from "@/lib/runmanage/week-board-filters";
import { listRunSeriesForClub, listRunSeriesForManage } from "@/lib/runmanage/series-manage-list";
import {
  type RunSeriesMetaInput,
  upsertRunSeriesMetaOnly,
} from "@/lib/runmanage/run-series-meta-upsert";

export const dynamic = "force-dynamic";

/**
 * GET /api/runmanage/run-series?region=&city=&weekOffset=&runClubId=&view=manage|week
 * Week view: region/city optional (narrow the list). Manage view: needs region + city.
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
  const view = params.get("view")?.trim() || "week";

  const filterOptions = await listRegionCityOptions();

  try {
    if (view === "manage") {
      if (runClubId && !regionSlug && !citySlug) {
        const manageSeries = await listRunSeriesForClub(runClubId);
        return NextResponse.json({
          success: true,
          needsFilters: false,
          clubScoped: true,
          filterOptions,
          manageSeries,
        });
      }
      if (!regionSlug || !citySlug) {
        return NextResponse.json({
          success: true,
          needsFilters: true,
          filterOptions,
          manageSeries: [],
        });
      }
      const manageSeries = await listRunSeriesForManage({
        regionSlug,
        citySlug,
        runClubId,
      });
      return NextResponse.json({
        success: true,
        needsFilters: false,
        filterOptions,
        manageSeries,
      });
    }

    const { window, series } = await buildWeekQueueSeriesList({
      regionSlug: regionSlug || null,
      citySlug: citySlug || null,
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

/**
 * POST /api/runmanage/run-series — create or upsert run_series meta only (no city_run).
 */
export async function POST(request: NextRequest) {
  const auth = await assertRunManageAuth(request);
  if (auth instanceof NextResponse) return auth;

  let body: RunSeriesMetaInput & { seriesId?: string | null };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const series = await upsertRunSeriesMetaOnly({
      seriesId: body.seriesId,
      runClubId: body.runClubId,
      dayOfWeek: body.dayOfWeek,
      name: body.name,
      description: body.description,
      citySlug: body.citySlug,
      meetUpPoint: body.meetUpPoint,
      meetUpStreetAddress: body.meetUpStreetAddress,
      meetUpCity: body.meetUpCity,
      meetUpState: body.meetUpState,
      meetUpPlaceId: body.meetUpPlaceId,
      meetUpLat: body.meetUpLat,
      meetUpLng: body.meetUpLng,
      startTimeHour: body.startTimeHour,
      startTimeMinute: body.startTimeMinute,
      startTimePeriod: body.startTimePeriod,
      runType: body.runType,
      totalMiles: body.totalMiles,
      routeNeighborhood: body.routeNeighborhood,
      workoutDescription: body.workoutDescription,
      postRunActivity: body.postRunActivity,
    });
    return NextResponse.json({ success: true, series });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[POST /api/runmanage/run-series]", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to save series" },
      { status: 500 }
    );
  }
}
