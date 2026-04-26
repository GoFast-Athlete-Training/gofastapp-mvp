export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTrainingSubjectAthleteId } from "@/lib/training/resolve-training-subject-athlete";
import { parseOptionalWorkoutDate } from "@/lib/training/workout-date-parse";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const resolved = await resolveTrainingSubjectAthleteId(request);
  if (!resolved.ok) return resolved.response;

  const { id } = await ctx.params;
  const row = await prisma.bike_workout.findFirst({
    where: { id, athleteId: resolved.athleteId },
    include: {
      steps: { orderBy: { stepOrder: "asc" } },
      tri_workout_leg: { select: { id: true, triWorkoutId: true, legOrder: true } },
    },
  });

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, bikeWorkout: row });
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
  const existing = await prisma.bike_workout.findFirst({
    where: { id, athleteId: resolved.athleteId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};

  if ("title" in body) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ error: "title must be non-empty" }, { status: 400 });
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

  if ("ftpWattsSnapshot" in body) {
    if (body.ftpWattsSnapshot === null) {
      data.ftpWattsSnapshot = null;
    } else if (typeof body.ftpWattsSnapshot === "number" && Number.isFinite(body.ftpWattsSnapshot)) {
      data.ftpWattsSnapshot = Math.round(body.ftpWattsSnapshot);
    } else {
      return NextResponse.json({ error: "ftpWattsSnapshot invalid" }, { status: 400 });
    }
  }

  if ("notes" in body) {
    if (body.notes !== null && typeof body.notes !== "string") {
      return NextResponse.json({ error: "notes invalid" }, { status: 400 });
    }
    data.notes = body.notes;
  }

  if (Array.isArray(body.steps)) {
    if (body.steps.length === 0) {
      return NextResponse.json({ error: "steps cannot be empty" }, { status: 400 });
    }
    for (const item of body.steps) {
      if (!item || typeof item !== "object") {
        return NextResponse.json({ error: "Invalid steps array" }, { status: 400 });
      }
      const o = item as Record<string, unknown>;
      if (typeof o.stepOrder !== "number" || typeof o.title !== "string" || !o.title.trim()) {
        return NextResponse.json({ error: "Invalid steps array" }, { status: 400 });
      }
      if (typeof o.intensity !== "string" || typeof o.durationType !== "string") {
        return NextResponse.json({ error: "Invalid steps array" }, { status: 400 });
      }
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (Array.isArray(body.steps)) {
      await tx.bike_workout_step.deleteMany({ where: { bikeWorkoutId: id } });
      let sumSec = 0;
      for (const item of body.steps) {
        const o = item as Record<string, unknown>;
        const mult = typeof o.repeatCount === "number" && o.repeatCount > 0 ? o.repeatCount : 1;
        const dt = String(o.durationType).trim().toUpperCase();
        if (dt !== "OPEN") {
          sumSec += (typeof o.durationSeconds === "number" ? o.durationSeconds : 0) * mult;
        }
        await tx.bike_workout_step.create({
          data: {
            bikeWorkoutId: id,
            stepOrder: o.stepOrder as number,
            title: (o.title as string).trim(),
            intensity: (o.intensity as string).trim(),
            repeatCount: typeof o.repeatCount === "number" ? o.repeatCount : null,
            durationType: (o.durationType as string).trim(),
            durationSeconds: typeof o.durationSeconds === "number" ? o.durationSeconds : null,
            powerWattsLow: typeof o.powerWattsLow === "number" ? o.powerWattsLow : null,
            powerWattsHigh: typeof o.powerWattsHigh === "number" ? o.powerWattsHigh : null,
            heartRateLow: typeof o.heartRateLow === "number" ? o.heartRateLow : null,
            heartRateHigh: typeof o.heartRateHigh === "number" ? o.heartRateHigh : null,
            cadenceLow: typeof o.cadenceLow === "number" ? o.cadenceLow : null,
            cadenceHigh: typeof o.cadenceHigh === "number" ? o.cadenceHigh : null,
            notes: typeof o.notes === "string" ? o.notes : null,
          },
        });
      }
      data.estimatedDurationSeconds = sumSec > 0 ? sumSec : null;
    }

    return tx.bike_workout.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
  });

  return NextResponse.json({ success: true, bikeWorkout: updated });
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const resolved = await resolveTrainingSubjectAthleteId(request);
  if (!resolved.ok) return resolved.response;

  const { id } = await ctx.params;
  const existing = await prisma.bike_workout.findFirst({
    where: { id, athleteId: resolved.athleteId },
    include: { tri_workout_leg: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.tri_workout_leg) {
    return NextResponse.json(
      {
        error:
          "This bike workout is linked to a tri session. Remove it from the tri session leg first.",
      },
      { status: 409 }
    );
  }

  await prisma.bike_workout.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
