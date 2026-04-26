export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTrainingSubjectAthleteId } from "@/lib/training/resolve-training-subject-athlete";
import { parseOptionalWorkoutDate } from "@/lib/training/workout-date-parse";

type Ctx = { params: Promise<{ id: string }> };

const legInclude = {
  bikeWorkout: { include: { steps: { orderBy: { stepOrder: "asc" as const } } } },
  swimWorkout: { include: { steps: { orderBy: { stepOrder: "asc" as const } } } },
  runWorkout: { include: { segments: { orderBy: { stepOrder: "asc" as const } } } },
} as const;

export async function GET(request: NextRequest, ctx: Ctx) {
  const resolved = await resolveTrainingSubjectAthleteId(request);
  if (!resolved.ok) return resolved.response;

  const { id } = await ctx.params;
  const row = await prisma.tri_workout.findFirst({
    where: { id, athleteId: resolved.athleteId },
    include: { legs: { orderBy: { legOrder: "asc" }, include: legInclude } },
  });

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, triWorkout: row });
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
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

  const { id } = await ctx.params;
  const existing = await prisma.tri_workout.findFirst({
    where: { id, athleteId: resolved.athleteId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};

  if ("title" in body) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ error: "title invalid" }, { status: 400 });
    }
    data.title = body.title.trim();
  }

  if ("description" in body) {
    if (body.description !== null && typeof body.description !== "string") {
      return NextResponse.json({ error: "description invalid" }, { status: 400 });
    }
    data.description = body.description;
  }

  if ("date" in body) {
    data.date = parseOptionalWorkoutDate(body.date) ?? null;
  }

  if ("notes" in body) {
    if (body.notes !== null && typeof body.notes !== "string") {
      return NextResponse.json({ error: "notes invalid" }, { status: 400 });
    }
    data.notes = body.notes;
  }

  const updated = await prisma.tri_workout.update({
    where: { id },
    data,
    include: { legs: { orderBy: { legOrder: "asc" }, include: legInclude } },
  });

  return NextResponse.json({ success: true, triWorkout: updated });
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const resolved = await resolveTrainingSubjectAthleteId(request);
  if (!resolved.ok) return resolved.response;

  const { id } = await ctx.params;
  const existing = await prisma.tri_workout.findFirst({
    where: { id, athleteId: resolved.athleteId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.tri_workout.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
