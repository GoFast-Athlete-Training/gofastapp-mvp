export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/race-hub/public/resolve-by-slug/[slug]
 * Public race card for invite flow — no auth.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: raw } = await params;
    const slug = raw?.trim();
    if (!slug) {
      return NextResponse.json({ success: false, error: "slug required" }, { status: 400 });
    }

    const race = await prisma.race_registry.findFirst({
      where: {
        slug,
        isActive: true,
        isCancelled: false,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        raceDate: true,
        city: true,
        state: true,
        distanceLabel: true,
      },
    });

    if (!race) {
      return NextResponse.json({ success: false, error: "Race not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      race: {
        id: race.id,
        name: race.name,
        slug: race.slug,
        logoUrl: race.logoUrl,
        raceDate: race.raceDate.toISOString(),
        city: race.city,
        state: race.state,
        distanceLabel: race.distanceLabel,
      },
    });
  } catch (err) {
    console.error("resolve-by-slug:", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
