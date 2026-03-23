export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { getAthleteByFirebaseId } from "@/lib/domain-athlete";
import { prisma } from "@/lib/prisma";

async function athleteFromAuth(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.substring(7));
    const athlete = await getAthleteByFirebaseId(decoded.uid);
    if (!athlete) {
      return { error: NextResponse.json({ error: "Athlete not found" }, { status: 404 }) };
    }
    return { athlete };
  } catch {
    return { error: NextResponse.json({ error: "Invalid token" }, { status: 401 }) };
  }
}

const raceInclude = {
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
} as const;

/** GET /api/race-signups — my self-declared races, ordered by race date */
export async function GET(request: NextRequest) {
  try {
    const { athlete, error } = await athleteFromAuth(request.headers.get("authorization"));
    if (error) return error;

    const signups = await prisma.athlete_race_signups.findMany({
      where: { athleteId: athlete!.id },
      include: { race_registry: raceInclude },
      orderBy: { race_registry: { raceDate: "asc" } },
    });

    return NextResponse.json({ signups });
  } catch (err: unknown) {
    console.error("GET /api/race-signups:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}

/** POST /api/race-signups — body { raceRegistryId, goalId? } */
export async function POST(request: NextRequest) {
  try {
    const { athlete, error } = await athleteFromAuth(request.headers.get("authorization"));
    if (error) return error;

    const body = await request.json().catch(() => ({}));
    const raceRegistryId =
      typeof body.raceRegistryId === "string" ? body.raceRegistryId.trim() : "";
    const goalIdExplicit = Object.prototype.hasOwnProperty.call(body, "goalId");
    const goalIdResolved =
      goalIdExplicit && typeof body.goalId === "string" && body.goalId.trim()
        ? body.goalId.trim()
        : goalIdExplicit
          ? null
          : undefined;

    if (!raceRegistryId) {
      return NextResponse.json({ error: "raceRegistryId required" }, { status: 400 });
    }

    const race = await prisma.race_registry.findFirst({
      where: { id: raceRegistryId, isActive: true, isCancelled: false },
    });
    if (!race) {
      return NextResponse.json({ error: "Race not found" }, { status: 404 });
    }

    if (goalIdResolved) {
      const goal = await prisma.athleteGoal.findFirst({
        where: { id: goalIdResolved, athleteId: athlete!.id },
      });
      if (!goal) {
        return NextResponse.json({ error: "Goal not found" }, { status: 404 });
      }
    }

    const signup = await prisma.athlete_race_signups.upsert({
      where: {
        athleteId_raceRegistryId: {
          athleteId: athlete!.id,
          raceRegistryId,
        },
      },
      create: {
        athleteId: athlete!.id,
        raceRegistryId,
        goalId: goalIdExplicit ? goalIdResolved ?? null : null,
      },
      update: goalIdExplicit ? { goalId: goalIdResolved ?? null } : {},
      include: { race_registry: raceInclude },
    });

    return NextResponse.json({ signup });
  } catch (err: unknown) {
    console.error("POST /api/race-signups:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}
