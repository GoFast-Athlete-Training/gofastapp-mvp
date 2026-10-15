import { loadPublicAthleteRaceCard } from "@/lib/athlete-race-public-card-load";
import { appendCheer, parseMyCheers, sanitizeCheerInput } from "@/lib/athlete-race-cheers";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ raceSlug: string; handle: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { raceSlug, handle } = await context.params;
    const card = await loadPublicAthleteRaceCard(handle, raceSlug);
    if (!card) {
      return NextResponse.json({ success: false, error: "Race card not found" }, { status: 404 });
    }

    const body = (await request.json()) as { name?: string; message?: string };
    const sanitized = sanitizeCheerInput(body.name ?? "", body.message ?? "");
    if (!sanitized) {
      return NextResponse.json({ success: false, error: "Name and message are required" }, { status: 400 });
    }

    const row = await prisma.athlete_races.findUnique({
      where: { id: card.athleteRaceId },
      select: { myCheers: true },
    });
    if (!row) {
      return NextResponse.json({ success: false, error: "Race card not found" }, { status: 404 });
    }

    const existing = parseMyCheers(row.myCheers);
    const next = appendCheer(existing, sanitized);

    await prisma.athlete_races.update({
      where: { id: card.athleteRaceId },
      data: { myCheers: next },
    });

    const entry = next[next.length - 1]!;
    return NextResponse.json({ success: true, cheer: entry, cheers: next }, { status: 201 });
  } catch (err) {
    console.error("public athlete-race-card cheer POST:", err);
    return NextResponse.json({ success: false, error: "Failed to save message" }, { status: 500 });
  }
}
