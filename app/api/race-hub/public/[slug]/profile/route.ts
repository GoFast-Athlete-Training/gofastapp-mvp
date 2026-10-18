export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveActiveRaceBySlugOrId } from "@/lib/race-hub/resolve-active-race-by-slug";

/** GET /api/race-hub/public/[slug]/profile — welcome text, no auth */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug: raw } = await params;
    const race = await resolveActiveRaceBySlugOrId(raw ?? "");
    if (!race) {
      return NextResponse.json({ success: false, error: "Race not found" }, { status: 404 });
    }

    const profile = await prisma.race_hub_profiles.findUnique({
      where: { raceId: race.id },
      select: { welcomeText: true, updatedAt: true },
    });

    return NextResponse.json({
      success: true,
      raceId: race.id,
      welcomeText: profile?.welcomeText ?? null,
      updatedAt: profile?.updatedAt?.toISOString() ?? null,
    });
  } catch (err) {
    console.error("race-hub public profile GET:", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
