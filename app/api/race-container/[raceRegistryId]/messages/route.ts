export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAthleteFromBearer } from "@/lib/race-container-auth";
import { requireRaceMembership } from "@/lib/race-container-membership";

/** GET /api/race-container/[raceRegistryId]/messages */
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
      return NextResponse.json(
        { error: auth.error, code: "AUTH_REQUIRED" },
        { status: auth.status }
      );
    }

    const race = await prisma.race_registry.findFirst({
      where: { id: raceRegistryId.trim(), isActive: true },
    });
    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    const membership = await requireRaceMembership(auth.athlete.id, race.id);
    if (!membership) {
      return NextResponse.json(
        { error: "Join this race to view chatter", code: "MEMBERSHIP_REQUIRED" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const topic = searchParams.get("topic") || undefined;

    const messages = await prisma.race_messages.findMany({
      where: { raceId: race.id, ...(topic ? { topic } : {}) },
      include: {
        Athlete: {
          select: { id: true, firstName: true, lastName: true, photoURL: true, gofastHandle: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ success: true, messages });
  } catch (err) {
    console.error("race messages GET:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** POST /api/race-container/[raceRegistryId]/messages */
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

    const body = await request.json().catch(() => ({}));
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const topic = typeof body.topic === "string" && body.topic.trim() ? body.topic.trim() : "general";

    if (!content) {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    const race = await prisma.race_registry.findFirst({
      where: { id: raceRegistryId.trim(), isActive: true },
    });
    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    const membership = await requireRaceMembership(auth.athlete.id, race.id);
    if (!membership) {
      return NextResponse.json({ error: "Join this race to post chatter" }, { status: 403 });
    }

    const message = await prisma.race_messages.create({
      data: {
        raceId: race.id,
        athleteId: auth.athlete.id,
        content,
        topic,
      },
      include: {
        Athlete: {
          select: { id: true, firstName: true, lastName: true, photoURL: true, gofastHandle: true },
        },
      },
    });

    return NextResponse.json({ success: true, message });
  } catch (err) {
    console.error("race messages POST:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}