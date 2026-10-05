export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/race-hub/public/shakeouts-by-company-race/[companyRaceId]
 * Public list of shakeout city_runs for Content Studio crossover.
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
      },
      orderBy: { date: "asc" },
      select: {
        id: true,
        slug: true,
        title: true,
      },
    });

    const shakeouts = runs.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      companyEventId: r.id,
    }));

    return NextResponse.json({ success: true, shakeouts });
  } catch (err) {
    console.error("shakeouts-by-company-race:", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
