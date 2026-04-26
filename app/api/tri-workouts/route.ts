export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TriSport } from "@prisma/client";
import { resolveTrainingSubjectAthleteId } from "@/lib/training/resolve-training-subject-athlete";
import { parseOptionalWorkoutDate } from "@/lib/training/workout-date-parse";

type LegInput = {
  legOrder: number;
  sport: string;
  title?: string | null;
  bikeWorkoutId?: string | null;
  swimWorkoutId?: string | null;
  runWorkoutId?: string | null;
};

function parseLegs(raw: unknown): LegInput[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: LegInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const o = item as Record<string, unknown>;
    if (typeof o.legOrder !== "number" || !Number.isFinite(o.legOrder)) return null;
    if (typeof o.sport !== "string" || !o.sport.trim()) return null;
    out.push({
      legOrder: o.legOrder,
      sport: o.sport.trim(),
      title: typeof o.title === "string" ? o.title : null,
      bikeWorkoutId: typeof o.bikeWorkoutId === "string" ? o.bikeWorkoutId : null,
      swimWorkoutId: typeof o.swimWorkoutId === "string" ? o.swimWorkoutId : null,
      runWorkoutId: typeof o.runWorkoutId === "string" ? o.runWorkoutId : null,
    });
  }
  return out;
}

function sportEnum(s: string): TriSport | null {
  const u = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  if (u === "Swim" || u === "Bike" || u === "Run") {
    return TriSport[u as keyof typeof TriSport];
  }
  return null;
}

/**
 * GET /api/tri-workouts?athleteId=…
 */
export async function GET(request: NextRequest) {
  const resolved = await resolveTrainingSubjectAthleteId(request);
  if (!resolved.ok) return resolved.response;

  const rows = await prisma.tri_workout.findMany({
    where: { athleteId: resolved.athleteId },
    orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
    include: {
      legs: {
        orderBy: { legOrder: "asc" },
        include: {
          bikeWorkout: { include: { steps: { orderBy: { stepOrder: "asc" } } } },
          swimWorkout: { include: { steps: { orderBy: { stepOrder: "asc" } } } },
          runWorkout: { include: { segments: { orderBy: { stepOrder: "asc" } } } },
        },
      },
    },
  });

  return NextResponse.json({ success: true, triWorkouts: rows });
}

/**
 * POST /api/tri-workouts — create session + legs (each leg links an existing sport workout).
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const resolved = await resolveTrainingSubjectAthleteId(
    request,
    typeof body.athleteId === "string" ? body.athleteId : null
  );
  if (!resolved.ok) return resolved.response;

  const athleteId = resolved.athleteId;

  if (typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const legsIn = parseLegs(body.legs);
  if (!legsIn) {
    return NextResponse.json(
      { error: "legs must be a non-empty array" },
      { status: 400 }
    );
  }

  const description =
    body.description === null || body.description === undefined
      ? null
      : typeof body.description === "string"
        ? body.description
        : null;
  if (body.description != null && typeof body.description !== "string") {
    return NextResponse.json({ error: "description invalid" }, { status: 400 });
  }

  const date = parseOptionalWorkoutDate(body.date);
  const notes =
    body.notes === null || body.notes === undefined
      ? null
      : typeof body.notes === "string"
        ? body.notes
        : null;
  if (body.notes != null && typeof body.notes !== "string") {
    return NextResponse.json({ error: "notes invalid" }, { status: 400 });
  }

  for (const leg of legsIn) {
    const sp = sportEnum(leg.sport);
    if (!sp) {
      return NextResponse.json(
        { error: `Invalid sport on leg ${leg.legOrder}: ${leg.sport}` },
        { status: 400 }
      );
    }
    const fkCount =
      (leg.bikeWorkoutId ? 1 : 0) + (leg.swimWorkoutId ? 1 : 0) + (leg.runWorkoutId ? 1 : 0);
    if (fkCount !== 1) {
      return NextResponse.json(
        { error: `Leg ${leg.legOrder} must have exactly one workout id for its sport` },
        { status: 400 }
      );
    }
    if (sp === TriSport.Bike && !leg.bikeWorkoutId) {
      return NextResponse.json({ error: `Leg ${leg.legOrder}: bikeWorkoutId required` }, { status: 400 });
    }
    if (sp === TriSport.Swim && !leg.swimWorkoutId) {
      return NextResponse.json({ error: `Leg ${leg.legOrder}: swimWorkoutId required` }, { status: 400 });
    }
    if (sp === TriSport.Run && !leg.runWorkoutId) {
      return NextResponse.json({ error: `Leg ${leg.legOrder}: runWorkoutId required` }, { status: 400 });
    }
  }

  for (const leg of legsIn) {
    const sp = sportEnum(leg.sport)!;
    if (sp === TriSport.Bike && leg.bikeWorkoutId) {
      const w = await prisma.bike_workout.findFirst({
        where: { id: leg.bikeWorkoutId, athleteId },
        include: { tri_workout_leg: true },
      });
      if (!w) {
        return NextResponse.json(
          { error: `Bike workout not found: ${leg.bikeWorkoutId}` },
          { status: 400 }
        );
      }
      if (w.tri_workout_leg) {
        return NextResponse.json(
          { error: `Bike workout ${leg.bikeWorkoutId} is already linked to a tri session` },
          { status: 409 }
        );
      }
    }
    if (sp === TriSport.Swim && leg.swimWorkoutId) {
      const w = await prisma.swim_workout.findFirst({
        where: { id: leg.swimWorkoutId, athleteId },
        include: { tri_workout_leg: true },
      });
      if (!w) {
        return NextResponse.json(
          { error: `Swim workout not found: ${leg.swimWorkoutId}` },
          { status: 400 }
        );
      }
      if (w.tri_workout_leg) {
        return NextResponse.json(
          { error: `Swim workout ${leg.swimWorkoutId} is already linked to a tri session` },
          { status: 409 }
        );
      }
    }
    if (sp === TriSport.Run && leg.runWorkoutId) {
      const w = await prisma.workouts.findFirst({
        where: { id: leg.runWorkoutId, athleteId },
        include: { tri_workout_leg: true },
      });
      if (!w) {
        return NextResponse.json(
          { error: `Run workout not found: ${leg.runWorkoutId}` },
          { status: 400 }
        );
      }
      if (w.tri_workout_leg) {
        return NextResponse.json(
          { error: `Run workout ${leg.runWorkoutId} is already linked to a tri session` },
          { status: 409 }
        );
      }
    }
  }

  const created = await prisma.tri_workout.create({
    data: {
      athleteId,
      title: body.title.trim(),
      description,
      date: date ?? null,
      notes,
      legs: {
        create: legsIn.map((leg) => ({
          legOrder: leg.legOrder,
          sport: sportEnum(leg.sport)!,
          title: leg.title?.trim() || null,
          bikeWorkoutId: leg.bikeWorkoutId ?? null,
          swimWorkoutId: leg.swimWorkoutId ?? null,
          runWorkoutId: leg.runWorkoutId ?? null,
        })),
      },
    },
    include: {
      legs: {
        orderBy: { legOrder: "asc" },
        include: {
          bikeWorkout: true,
          swimWorkout: true,
          runWorkout: { select: { id: true, title: true, workoutType: true } },
        },
      },
    },
  });

  return NextResponse.json({ success: true, triWorkout: created });
}
