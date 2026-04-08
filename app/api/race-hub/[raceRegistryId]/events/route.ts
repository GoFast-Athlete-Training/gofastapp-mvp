export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAthleteFromBearer } from "@/lib/race-container-auth";
import { requireRaceMembership } from "@/lib/race-container-membership";

/** GET — members only */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ raceRegistryId: string }> }
) {
  try {
    const { raceRegistryId } = await params;
    if (!raceRegistryId?.trim()) {
      return NextResponse.json({ error: "raceRegistryId required" }, { status: 400 });
    }

    const auth = await getAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const race = await prisma.race_registry.findFirst({
      where: { id: raceRegistryId.trim(), isActive: true },
    });
    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    const membership = await requireRaceMembership(auth.athlete.id, race.id);
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const events = await prisma.race_events.findMany({
      where: { raceId: race.id },
      orderBy: { date: "asc" },
      include: {
        organizer: {
          select: { id: true, firstName: true, lastName: true, photoURL: true },
        },
        race_event_rsvps: {
          where: { athleteId: auth.athlete.id },
          take: 1,
        },
      },
    });

    return NextResponse.json({ success: true, events });
  } catch (err) {
    console.error("race events GET:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** POST — members can create (mirrors crew events) */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ raceRegistryId: string }> }
) {
  try {
    const { raceRegistryId } = await params;
    if (!raceRegistryId?.trim()) {
      return NextResponse.json({ error: "raceRegistryId required" }, { status: 400 });
    }

    const auth = await getAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const race = await prisma.race_registry.findFirst({
      where: { id: raceRegistryId.trim(), isActive: true },
    });
    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    const membership = await requireRaceMembership(auth.athlete.id, race.id);
    if (!membership) {
      return NextResponse.json({ error: "Join this race to create events" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const time = typeof body.time === "string" ? body.time.trim() : "";
    const venue = typeof body.venue === "string" ? body.venue.trim() : "";
    const dateRaw = body.date;
    const date =
      typeof dateRaw === "string" || dateRaw instanceof Date
        ? new Date(dateRaw)
        : null;

    if (!title || !time || !venue || !date || Number.isNaN(date.getTime())) {
      return NextResponse.json(
        { error: "title, time, venue, and valid date required" },
        { status: 400 }
      );
    }

    const address = typeof body.address === "string" ? body.address.trim() || null : null;
    const description =
      typeof body.description === "string" ? body.description.trim() || null : null;
    const additionalDetails =
      typeof body.additionalDetails === "string"
        ? body.additionalDetails.trim() || null
        : null;
    const cost =
      typeof body.cost === "number" && Number.isFinite(body.cost)
        ? Math.floor(body.cost)
        : null;

    const event = await prisma.race_events.create({
      data: {
        raceId: race.id,
        organizerId: auth.athlete.id,
        title,
        date,
        time,
        venue,
        address,
        description,
        additionalDetails,
        cost,
      },
      include: {
        organizer: {
          select: { id: true, firstName: true, lastName: true, photoURL: true },
        },
      },
    });

    return NextResponse.json({ success: true, event });
  } catch (err) {
    console.error("race events POST:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
