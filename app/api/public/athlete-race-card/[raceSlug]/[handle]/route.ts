import { loadPublicAthleteRaceCard } from "@/lib/athlete-race-public-card-load";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ raceSlug: string; handle: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { raceSlug, handle } = await context.params;
    const card = await loadPublicAthleteRaceCard(handle, raceSlug);
    if (!card) {
      return NextResponse.json({ success: false, error: "Race card not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, card });
  } catch (err) {
    console.error("public athlete-race-card GET:", err);
    return NextResponse.json({ success: false, error: "Failed to load race card" }, { status: 500 });
  }
}
