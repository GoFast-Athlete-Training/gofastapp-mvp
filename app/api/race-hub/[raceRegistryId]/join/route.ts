export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAthleteFromBearer } from "@/lib/race-container-auth";

/** POST /api/race-hub/[raceRegistryId]/join — join Race Hub (full membership: chatter, events, announcements) */
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
      where: {
        id: raceRegistryId.trim(),
        isActive: true,
        isCancelled: false,
      },
    });
    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    const membership = await prisma.race_memberships.upsert({
      where: {
        raceId_athleteId: { raceId: race.id, athleteId: auth.athlete.id },
      },
      create: {
        raceId: race.id,
        athleteId: auth.athlete.id,
        role: "MEMBER",
      },
      update: {},
    });

    return NextResponse.json({ success: true, membership });
  } catch (err) {
    console.error("race-hub join:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** DELETE /api/race-hub/[raceRegistryId]/join — leave Race Hub */
export async function DELETE(
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

    await prisma.race_memberships.deleteMany({
      where: {
        raceId: raceRegistryId.trim(),
        athleteId: auth.athlete.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("race-hub leave:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
