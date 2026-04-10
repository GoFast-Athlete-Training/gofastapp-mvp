export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { prisma } from "@/lib/prisma";

/** GET /api/race-registry/[id] — one registry row for authenticated athlete (prefill Goals / setup). */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const race = await prisma.race_registry.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        companyRaceId: true,
        distanceLabel: true,
        distanceMeters: true,
        raceDate: true,
        city: true,
        state: true,
        country: true,
        registrationUrl: true,
        logoUrl: true,
        description: true,
        courseMapUrl: true,
        resultsUrl: true,
        startTime: true,
        packetPickupLocation: true,
        packetPickupDate: true,
        packetPickupTime: true,
        packetPickupDescription: true,
        spectatorInfo: true,
        logisticsInfo: true,
        gearDropInstructions: true,
      },
    });

    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    return NextResponse.json({ race });
  } catch (e: unknown) {
    console.error("GET /api/race-registry/[id]", e);
    return NextResponse.json(
      { error: "Server error", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 }
    );
  }
}
