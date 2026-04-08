export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAthleteFromBearer } from "@/lib/race-container-auth";
import { requireRaceMembership } from "@/lib/race-container-membership";

const ALLOWED = new Set(["going", "not-going", "maybe"]);

/** POST body: { status: "going" | "not-going" | "maybe" } */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ raceRegistryId: string; eventId: string }> }
) {
  try {
    const { raceRegistryId, eventId } = await params;
    if (!raceRegistryId?.trim() || !eventId?.trim()) {
      return NextResponse.json({ error: "Missing ids" }, { status: 400 });
    }

    const auth = await getAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const membership = await requireRaceMembership(auth.athlete.id, raceRegistryId.trim());
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const event = await prisma.race_events.findFirst({
      where: { id: eventId.trim(), raceId: raceRegistryId.trim() },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const status = typeof body.status === "string" ? body.status.trim() : "";
    if (!ALLOWED.has(status)) {
      return NextResponse.json(
        { error: "status must be going, not-going, or maybe" },
        { status: 400 }
      );
    }

    const rsvp = await prisma.race_event_rsvps.upsert({
      where: {
        eventId_athleteId: { eventId: event.id, athleteId: auth.athlete.id },
      },
      create: {
        eventId: event.id,
        athleteId: auth.athlete.id,
        status,
      },
      update: { status },
    });

    return NextResponse.json({ success: true, rsvp });
  } catch (err) {
    console.error("race event rsvp:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
