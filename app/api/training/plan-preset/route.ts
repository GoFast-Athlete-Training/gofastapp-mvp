export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";

/** Staff GET — full preset list for Training Manage (prod SOT). */
export async function GET(request: NextRequest) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  const rows = await prisma.training_plan_preset.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      targetDistanceLabel: true,
      snapPeakLongRunMiles: true,
      snapPeakWeeklyMiles: true,
      buildPreset: { select: { name: true } },
      taperPreset: { select: { name: true } },
      raceWeekPreset: { select: { title: true } },
    },
  });

  return NextResponse.json({
    success: true,
    presets: rows.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      description: r.description,
      targetDistanceLabel: r.targetDistanceLabel,
      snapPeakLongRunMiles: r.snapPeakLongRunMiles,
      snapPeakWeeklyMiles: r.snapPeakWeeklyMiles,
      buildPreset: r.buildPreset,
      taperPreset: r.taperPreset,
      raceWeekPreset: r.raceWeekPreset,
    })),
  });
}
