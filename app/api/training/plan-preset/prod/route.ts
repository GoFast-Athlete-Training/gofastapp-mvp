export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";

/**
 * GET /api/training/plan-preset/prod
 *
 * Athlete-facing preset selection. Returns the appropriate preset for a given
 * fitness level. MVP1: only one preset exists (elite), so `fitnessLevel` is
 * accepted but always resolves to the first preset in the DB.
 *
 * Query params:
 *   fitnessLevel  string  optional — defaults to "elite"
 *
 * Future: map fitnessLevel → preset slug when multiple presets exist.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const fitnessLevel =
    request.nextUrl.searchParams.get("fitnessLevel")?.trim() || "elite";

  // MVP1: single preset in DB — return it regardless of fitnessLevel value.
  const preset = await prisma.training_plan_preset.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, slug: true, title: true, description: true },
  });

  if (!preset) {
    return NextResponse.json(
      { success: false, error: "No plan preset configured" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, preset, fitnessLevel });
}
