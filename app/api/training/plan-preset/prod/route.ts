export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";

/**
 * GET /api/training/plan-preset/prod
 *
 * Athlete-facing preset list for setup. MVP1: typically one preset (elite);
 * `fitnessLevel` is accepted for future slug/level mapping.
 *
 * Query params:
 *   fitnessLevel  string  optional — defaults to "elite" (reserved for future)
 */
export async function GET(request: NextRequest) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const fitnessLevel =
    request.nextUrl.searchParams.get("fitnessLevel")?.trim() || "elite";

  const presets = await prisma.training_plan_preset.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      publicDescription: true,
      volumeConstraints: {
        select: {
          minWeeklyMiles: true,
          maxWeeklyMiles: true,
          baseMiles: true,
        },
      },
    },
  });

  if (presets.length === 0) {
    return NextResponse.json(
      { success: false, error: "No plan preset configured" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, presets, fitnessLevel });
}
