export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAthleteFromBearer } from "@/lib/race-container-auth";
import { assertRaceHubReadAccessOrPublic } from "@/lib/race-hub/hub-read-access";
import { ensureRaceHubMembership } from "@/lib/race-hub/ensure-race-hub-membership";
import { normalizeRaceHubTopic } from "@/lib/race-hub/race-hub-topics";

/** GET /api/race-hub/[raceRegistryId]/messages */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ raceRegistryId: string }> }
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
      return NextResponse.json(
        { error: access.error, code: "MEMBERSHIP_REQUIRED" },
        { status: access.status }
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

/** POST /api/race-hub/[raceRegistryId]/messages */
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
    const topic = normalizeRaceHubTopic(
      typeof body.topic === "string" ? body.topic : undefined,
    );

    if (!content) {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    const race = await prisma.race_registry.findFirst({
      where: { id: raceRegistryId.trim(), isActive: true },
    });
    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    await ensureRaceHubMembership(auth.athlete.id, race.id);

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