export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAthleteFromBearer } from "@/lib/race-container-auth";
import { assertRaceAdmin, requireRaceMembership } from "@/lib/race-container-membership";

/** GET — race members only */
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

    const announcements = await prisma.race_announcements.findMany({
      where: { raceId: race.id, archivedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        Athlete: {
          select: { id: true, firstName: true, lastName: true, photoURL: true },
        },
      },
    });

    return NextResponse.json({ success: true, announcements });
  } catch (err) {
    console.error("race announcements GET:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** POST — race ADMIN only */
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

    const admin = await assertRaceAdmin(auth.athlete.id, raceRegistryId.trim());
    if (!admin) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const race = await prisma.race_registry.findFirst({
      where: { id: raceRegistryId.trim(), isActive: true },
    });
    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!title || !content) {
      return NextResponse.json({ error: "title and content required" }, { status: 400 });
    }

    const announcement = await prisma.race_announcements.create({
      data: {
        raceId: race.id,
        authorId: auth.athlete.id,
        title,
        content,
      },
      include: {
        Athlete: {
          select: { id: true, firstName: true, lastName: true, photoURL: true },
        },
      },
    });

    return NextResponse.json({ success: true, announcement });
  } catch (err) {
    console.error("race announcements POST:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
