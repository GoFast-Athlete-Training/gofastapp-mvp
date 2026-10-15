import { loadPublicAthleteRaceCard } from "@/lib/athlete-race-public-card-load";
import { parseMyCheers, removeCheer } from "@/lib/athlete-race-cheers";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ raceSlug: string; handle: string; cheerId: string }> };

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { raceSlug, handle, cheerId } = await context.params;
    const card = await loadPublicAthleteRaceCard(handle, raceSlug);
    if (!card) {
      return NextResponse.json({ success: false, error: "Race card not found" }, { status: 404 });
    }

    const row = await prisma.athlete_races.findUnique({
      where: { id: card.athleteRaceId },
      select: { myCheers: true },
    });
    if (!row) {
      return NextResponse.json({ success: false, error: "Race card not found" }, { status: 404 });
    }

    const existing = parseMyCheers(row.myCheers);
    const next = removeCheer(existing, cheerId);
    if (next.length === existing.length) {
      return NextResponse.json({ success: false, error: "Message not found" }, { status: 404 });
    }

    await prisma.athlete_races.update({
      where: { id: card.athleteRaceId },
      data: { myCheers: next },
    });

    return NextResponse.json({ success: true, cheers: next });
  } catch (err) {
    console.error("public athlete-race-card cheer DELETE:", err);
    return NextResponse.json({ success: false, error: "Failed to remove message" }, { status: 500 });
  }
}
