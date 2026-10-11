export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { presetMatchesDistance } from "@/lib/training/preset-distance-match";
import { fetchTrainingManageCatalogPresets } from "@/lib/training/fetch-training-manage-catalog";

/**
 * GET /api/training/plan-preset/prod
 *
 * Athlete-facing catalog list — Prod forwards Firebase Bearer to Training Manage.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const fitnessLevel =
    request.nextUrl.searchParams.get("fitnessLevel")?.trim() || "elite";

  const dmRaw = request.nextUrl.searchParams.get("distanceMeters");
  const distanceMeters =
    dmRaw != null && dmRaw !== "" && Number.isFinite(Number(dmRaw))
      ? Math.round(Number(dmRaw))
      : null;

  const rows = await fetchTrainingManageCatalogPresets(request.headers.get("authorization"));
  if (rows == null) {
    return NextResponse.json(
      { success: false, error: "Training catalog unavailable" },
      { status: 503 },
    );
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "No plan preset configured" },
      { status: 404 },
    );
  }

  const presets =
    distanceMeters == null
      ? rows
      : rows.filter((p) => presetMatchesDistance(p.targetDistanceLabel, distanceMeters));

  return NextResponse.json({
    success: true,
    presets,
    fitnessLevel,
    ...(distanceMeters != null ? { distanceMeters } : {}),
  });
}
