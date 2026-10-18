export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertRaceHubReadAccessOrPublic } from "@/lib/race-hub/hub-read-access";

/** GET /api/race-hub/[raceRegistryId]/profile — welcome text */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ raceRegistryId: string }> },
) {
  try {
    const { raceRegistryId } = await params;
    if (!raceRegistryId?.trim()) {
      return NextResponse.json({ error: "raceRegistryId required" }, { status: 400 });
    }

    const race = await prisma.race_registry.findFirst({
      where: { id: raceRegistryId.trim(), isActive: true },
    });
    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    const access = await assertRaceHubReadAccessOrPublic(request, race.id);
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const profile = await prisma.race_hub_profiles.findUnique({
      where: { raceId: race.id },
      select: { welcomeText: true, updatedAt: true },
    });

    return NextResponse.json({
      success: true,
      welcomeText: profile?.welcomeText ?? null,
      updatedAt: profile?.updatedAt?.toISOString() ?? null,
    });
  } catch (err) {
    console.error("race-hub profile GET:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
