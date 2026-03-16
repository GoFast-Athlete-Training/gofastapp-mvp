export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { prisma } from "@/lib/prisma";

async function getAthleteAndVerify(
  athleteId: string,
  authHeader: string | null
): Promise<{ athlete: { id: string }; error?: NextResponse }> {
  if (!authHeader?.startsWith("Bearer ")) {
    return { athlete: null as any, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
  } catch {
    return { athlete: null as any, error: NextResponse.json({ error: "Invalid token" }, { status: 401 }) };
  }
  const firebaseId = decodedToken.uid;
  if (!athleteId) {
    return { athlete: null as any, error: NextResponse.json({ error: "Athlete ID required" }, { status: 400 }) };
  }
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
  });
  if (!athlete) {
    return { athlete: null as any, error: NextResponse.json({ error: "Athlete not found" }, { status: 404 }) };
  }
  if (athlete.firebaseId !== firebaseId) {
    return {
      athlete: null as any,
      error: NextResponse.json({ error: "Forbidden", message: "You can only access your own data" }, { status: 403 }),
    };
  }
  return { athlete };
}

/** GET /api/athlete/[id]/race-goal-intent — return single intent for athlete with race_registry */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: athleteId } = await params;
    const authHeader = request.headers.get("authorization");
    const { athlete, error } = await getAthleteAndVerify(athleteId, authHeader);
    if (error) return error;

    const intent = await prisma.race_goal_intent.findUnique({
      where: { athleteId: athlete.id },
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

    return NextResponse.json({ race_goal_intent: intent ?? null });
  } catch (err: unknown) {
    console.error("Race goal intent GET:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/** PUT /api/athlete/[id]/race-goal-intent — upsert one row per athlete. Body: { raceId?, goalTime?, goalPace5K? } */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: athleteId } = await params;
    const authHeader = request.headers.get("authorization");
    const { athlete, error } = await getAthleteAndVerify(athleteId, authHeader);
    if (error) return error;

    let body: { raceId?: string | null; goalTime?: string | null; goalPace5K?: string | null } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const raceId = body.raceId === undefined ? undefined : body.raceId ?? null;
    const goalTime = body.goalTime === undefined ? undefined : body.goalTime ?? null;
    const goalPace5K = body.goalPace5K === undefined ? undefined : body.goalPace5K ?? null;

    const existing = await prisma.race_goal_intent.findUnique({
      where: { athleteId: athlete.id },
    });

    const data: {
      athleteId: string;
      raceId: string | null;
      goalTime: string | null;
      goalPace5K: string | null;
      updatedAt: Date;
    } = {
      athleteId: athlete.id,
      raceId: raceId ?? existing?.raceId ?? null,
      goalTime: goalTime ?? existing?.goalTime ?? null,
      goalPace5K: goalPace5K ?? existing?.goalPace5K ?? null,
      updatedAt: new Date(),
    };
    if (raceId !== undefined) data.raceId = raceId;
    if (goalTime !== undefined) data.goalTime = goalTime;
    if (goalPace5K !== undefined) data.goalPace5K = goalPace5K;

    const intent = existing
      ? await prisma.race_goal_intent.update({
          where: { athleteId: athlete.id },
          data: {
            raceId: data.raceId,
            goalTime: data.goalTime,
            goalPace5K: data.goalPace5K,
            updatedAt: data.updatedAt,
          },
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
        })
      : await prisma.race_goal_intent.create({
          data: {
            athleteId: athlete.id,
            raceId: data.raceId,
            goalTime: data.goalTime,
            goalPace5K: data.goalPace5K,
            updatedAt: data.updatedAt,
          },
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

    return NextResponse.json({ race_goal_intent: intent });
  } catch (err: unknown) {
    console.error("Race goal intent PUT:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
