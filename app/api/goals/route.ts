export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { getAthleteByFirebaseId } from "@/lib/domain-athlete";
import { createGoal } from "@/lib/goal-service";
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

/** GET /api/goals — list goals for authenticated athlete (?status=ACTIVE default, or ALL) */
export async function GET(request: NextRequest) {
  try {
    const { athlete, error } = await athleteFromAuth(request.headers.get("authorization"));
    if (error) return error;

    const status = request.nextUrl.searchParams.get("status");
    const where =
      status === "ALL"
        ? { athleteId: athlete!.id }
        : { athleteId: athlete!.id, status: status ?? "ACTIVE" };

    const goals = await prisma.athleteGoal.findMany({
      where,
      orderBy: { targetByDate: "asc" },
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
          },
        },
      },
    });

    return NextResponse.json({ goals });
  } catch (err: unknown) {
    console.error("GET /api/goals:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}

/** POST /api/goals — create goal (derives goalRacePace / goalPace5K) */
export async function POST(request: NextRequest) {
  try {
    const { athlete, error } = await athleteFromAuth(request.headers.get("authorization"));
    if (error) return error;

    let body: {
      name?: string | null;
      description?: string | null;
      distance?: string;
      goalTime?: string | null;
      targetByDate?: string;
      raceRegistryId?: string | null;
      status?: string;
      whyGoal?: string | null;
      successLooksLike?: string | null;
      completionFeeling?: string | null;
      motivationIcon?: string | null;
    } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const targetByDate = body.targetByDate
      ? new Date(body.targetByDate)
      : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(targetByDate.getTime())) {
      return NextResponse.json({ error: "Invalid targetByDate" }, { status: 400 });
    }

    try {
      const goal = await createGoal(athlete!.id, {
        name: body.name,
        description: body.description,
        distance: body.distance ?? "",
        goalTime: body.goalTime,
        targetByDate,
        raceRegistryId: body.raceRegistryId,
        status: body.status,
        whyGoal: body.whyGoal,
        successLooksLike: body.successLooksLike,
        completionFeeling: body.completionFeeling,
        motivationIcon: body.motivationIcon,
      });
      return NextResponse.json({ goal });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Create failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  } catch (err: unknown) {
    console.error("POST /api/goals:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}
