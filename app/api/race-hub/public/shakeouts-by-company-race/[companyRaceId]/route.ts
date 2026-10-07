export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializePublicShakeout } from "@/lib/race-hub-shakeout-utils";

/**
 * GET /api/race-hub/public/shakeouts-by-company-race/[companyRaceId]
 * Public list of published shakeout city_runs (Content Studio + race shakeouts page).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ companyRaceId: string }> },
) {
  try {
    const { companyRaceId } = await params;
    const id = companyRaceId?.trim();
    if (!id) {
      return NextResponse.json({ success: false, error: "companyRaceId required" }, { status: 400 });
    }

    const registries = await prisma.race_registry.findMany({
      where: { companyRaceId: id, isActive: true, isCancelled: false },
      select: { id: true },
    });

    if (registries.length === 0) {
      return NextResponse.json({ success: true, shakeouts: [] });
    }

    const registryIds = registries.map((r) => r.id);
    const runs = await prisma.city_runs.findMany({
      where: {
        raceRegistryId: { in: registryIds },
        cityRunType: "RACE_SHAKEOUT",
        published: true,
      },
      orderBy: { date: "asc" },
      include: {
        runClub: { select: { id: true, name: true, slug: true } },
      },
    });

    const shakeouts = runs.map((r) => serializePublicShakeout(r));

    return NextResponse.json({ success: true, shakeouts });
  } catch (err) {
    console.error("shakeouts-by-company-race:", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
