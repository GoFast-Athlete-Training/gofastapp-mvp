import { NextRequest, NextResponse } from "next/server";
import {
  assertRunManageAuth,
  staffGeneratedIdFromAuth,
} from "@/lib/runmanage/require-run-manage-auth";
import {
  prepareWeekForRegionCity,
  summarizePrepareWeek,
} from "@/lib/runmanage/prepare-week";

export const dynamic = "force-dynamic";

/**
 * POST /api/runmanage/prepare-week
 * Body: { regionSlug, citySlug, weekOffset? }
 * Clones missing this-week slots from latest prior run (no route auto-advance).
 */
export async function POST(request: NextRequest) {
  const auth = await assertRunManageAuth(request);
  if (auth instanceof NextResponse) return auth;

  let body: { regionSlug?: string; citySlug?: string; weekOffset?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const regionSlug = body.regionSlug?.trim();
  const citySlug = body.citySlug?.trim();
  if (!regionSlug || !citySlug) {
    return NextResponse.json(
      { success: false, error: "regionSlug and citySlug are required" },
      { status: 400 }
    );
  }

  try {
    const staffGeneratedId = staffGeneratedIdFromAuth(auth);
    const { window, results } = await prepareWeekForRegionCity({
      regionSlug,
      citySlug,
      staffGeneratedId,
      weekOffset: body.weekOffset ?? 0,
    });
    return NextResponse.json({
      success: true,
      window,
      summary: summarizePrepareWeek(results),
      results,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[POST /api/runmanage/prepare-week]", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Prepare week failed" },
      { status: 500 }
    );
  }
}
