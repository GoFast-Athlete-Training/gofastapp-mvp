export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { getAthleteByFirebaseId } from "@/lib/domain-athlete";
import { prisma } from "@/lib/prisma";

/** GET /api/race-registry/[id] — one registry row for authenticated athlete (prefill Goals / setup). */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const decoded = await adminAuth.verifyIdToken(authHeader.substring(7));
    const athlete = await getAthleteByFirebaseId(decoded.uid);
    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
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
        raceType: true,
        distanceMiles: true,
        raceDate: true,
        city: true,
        state: true,
        country: true,
        registrationUrl: true,
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
