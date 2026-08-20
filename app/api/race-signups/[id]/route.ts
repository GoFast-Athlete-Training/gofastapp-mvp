export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { prisma } from "@/lib/prisma";

async function athleteFromRequest(request: NextRequest) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return { error: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  }
  return { athlete: auth.athlete };
}

/** PATCH /api/race-signups/[id] — legacy no-op; goal lives on athlete_races row. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { athlete, error } = await athleteFromRequest(request);
    if (error) return error;

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const athleteRace = await prisma.athlete_races.findFirst({
      where: { id, athleteId: athlete!.id },
    });
    if (!athleteRace) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const signup = await prisma.athlete_races.findUnique({
      where: { id },
      include: {
        race_registry: {
          select: {
            id: true,
            name: true,
            distanceLabel: true,
            distanceMeters: true,
            raceDate: true,
            city: true,
            state: true,
            country: true,
            slug: true,
            logoUrl: true,
            registrationUrl: true,
            startTime: true,
          },
        },
      },
    });

    return NextResponse.json({ signup, athleteRace: signup });
  } catch (err: unknown) {
    console.error("PATCH /api/race-signups/[id]:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}

/** DELETE /api/race-signups/[id] — remove claimed athlete race */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { athlete, error } = await athleteFromRequest(request);
    if (error) return error;

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const existing = await prisma.athlete_races.findFirst({
      where: { id, athleteId: athlete!.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.athlete_races.delete({ where: { id } });

    await prisma.race_memberships.deleteMany({
      where: {
        athleteId: athlete!.id,
        raceId: existing.raceRegistryId,
        role: "MEMBER",
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("DELETE /api/race-signups/[id]:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}
