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

/** PATCH /api/race-signups/[id] — link goalId to this signup */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { athlete, error } = await athleteFromAuth(request.headers.get("authorization"));
    if (error) return error;

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    if (!Object.prototype.hasOwnProperty.call(body, "goalId")) {
      return NextResponse.json({ error: "goalId required (string or null)" }, { status: 400 });
    }
    const goalId =
      body.goalId == null
        ? null
        : typeof body.goalId === "string" && body.goalId.trim()
          ? body.goalId.trim()
          : null;

    const existing = await prisma.athlete_race_signups.findFirst({
      where: { id, athleteId: athlete!.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (goalId) {
      const goal = await prisma.athleteGoal.findFirst({
        where: { id: goalId, athleteId: athlete!.id },
      });
      if (!goal) {
        return NextResponse.json({ error: "Goal not found" }, { status: 404 });
      }
      if (goal.raceRegistryId !== existing.raceRegistryId) {
        return NextResponse.json(
          { error: "Goal must be for this race" },
          { status: 400 }
        );
      }
    }

    const signup = await prisma.athlete_race_signups.update({
      where: { id },
      data: { goalId },
      include: {
        race_registry: {
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
        },
      },
    });

    return NextResponse.json({ signup });
  } catch (err: unknown) {
    console.error("PATCH /api/race-signups/[id]:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}

/** DELETE /api/race-signups/[id] — remove "I'm in" */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { athlete, error } = await athleteFromAuth(request.headers.get("authorization"));
    if (error) return error;

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const existing = await prisma.athlete_race_signups.findFirst({
      where: { id, athleteId: athlete!.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.athlete_race_signups.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("DELETE /api/race-signups/[id]:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}
