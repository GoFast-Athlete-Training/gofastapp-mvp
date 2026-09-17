export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseCompanyEventId(
  shakeoutDedupeKey: string | null,
  registryId: string,
): string | null {
  if (!shakeoutDedupeKey) return null;
  const prefix = `shk-${registryId}-`;
  if (!shakeoutDedupeKey.startsWith(prefix)) return null;
  const rest = shakeoutDedupeKey.slice(prefix.length);
  const windowIdx = rest.lastIndexOf("-w");
  if (windowIdx <= 0) return null;
  return rest.slice(0, windowIdx) || null;
}

/**
 * GET /api/race-hub/public/shakeouts-by-company-race/[companyRaceId]
 * Public list of synced shakeout city_runs for Content Studio crossover.
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
        shakeoutDedupeKey: { not: null },
      },
      orderBy: { date: "asc" },
      select: {
        id: true,
        slug: true,
        title: true,
        shakeoutDedupeKey: true,
        raceRegistryId: true,
      },
    });

    const seen = new Set<string>();
    const shakeouts = runs
      .map((r) => {
        const companyEventId =
          parseCompanyEventId(r.shakeoutDedupeKey, r.raceRegistryId ?? "") ?? r.id;
        const dedupe = r.id;
        if (seen.has(dedupe)) return null;
        seen.add(dedupe);
        return {
          id: r.id,
          slug: r.slug,
          title: r.title,
          companyEventId,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ success: true, shakeouts });
  } catch (err) {
    console.error("shakeouts-by-company-race:", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
