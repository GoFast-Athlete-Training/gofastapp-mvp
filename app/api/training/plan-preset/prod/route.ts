export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { presetMatchesDistance } from "@/lib/training/preset-distance-match";

/**
 * GET /api/training/plan-preset/prod
 *
 * Athlete-facing catalog list — prod mirror only (no Training Manage hop).
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

  const rows = await prisma.training_plan_preset.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      publicDescription: true,
      targetDistanceLabel: true,
      minWeeklyMiles: true,
      maxWeeklyMiles: true,
      tempoIdealDow: true,
      intervalIdealDow: true,
      longRunDefaultDow: true,
    },
  });

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
