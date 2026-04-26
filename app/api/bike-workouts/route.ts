export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTrainingSubjectAthleteId } from "@/lib/training/resolve-training-subject-athlete";
import { parseOptionalWorkoutDate } from "@/lib/training/workout-date-parse";

type StepInput = {
  stepOrder: number;
  title: string;
  intensity: string;
  repeatCount?: number | null;
  durationType: string;
  durationSeconds?: number | null;
  powerWattsLow?: number | null;
  powerWattsHigh?: number | null;
  heartRateLow?: number | null;
  heartRateHigh?: number | null;
  cadenceLow?: number | null;
  cadenceHigh?: number | null;
  notes?: string | null;
};

function parseSteps(raw: unknown): StepInput[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: StepInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const o = item as Record<string, unknown>;
    if (typeof o.stepOrder !== "number" || !Number.isFinite(o.stepOrder)) return null;
    if (typeof o.title !== "string" || !o.title.trim()) return null;
    if (typeof o.intensity !== "string" || !o.intensity.trim()) return null;
    if (typeof o.durationType !== "string" || !o.durationType.trim()) return null;
    out.push({
      stepOrder: o.stepOrder,
      title: o.title.trim(),
      intensity: o.intensity.trim(),
      repeatCount: typeof o.repeatCount === "number" ? o.repeatCount : null,
      durationType: o.durationType.trim(),
      durationSeconds: typeof o.durationSeconds === "number" ? o.durationSeconds : null,
      powerWattsLow: typeof o.powerWattsLow === "number" ? o.powerWattsLow : null,
      powerWattsHigh: typeof o.powerWattsHigh === "number" ? o.powerWattsHigh : null,
      heartRateLow: typeof o.heartRateLow === "number" ? o.heartRateLow : null,
      heartRateHigh: typeof o.heartRateHigh === "number" ? o.heartRateHigh : null,
      cadenceLow: typeof o.cadenceLow === "number" ? o.cadenceLow : null,
      cadenceHigh: typeof o.cadenceHigh === "number" ? o.cadenceHigh : null,
      notes: typeof o.notes === "string" ? o.notes : null,
    });
  }
  return out;
}

/**
 * GET /api/bike-workouts?athleteId=… (staff) — list bike workouts for athlete.
 */
export async function GET(request: NextRequest) {
  const resolved = await resolveTrainingSubjectAthleteId(request);
  if (!resolved.ok) return resolved.response;

  const [rows, athlete] = await Promise.all([
    prisma.bike_workout.findMany({
      where: { athleteId: resolved.athleteId },
      orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
      include: {
        steps: { orderBy: { stepOrder: "asc" } },
        tri_workout_leg: { select: { id: true, triWorkoutId: true, legOrder: true } },
      },
    }),
    prisma.athlete.findUnique({
      where: { id: resolved.athleteId },
      select: { ftpWatts: true },
    }),
  ]);

  return NextResponse.json({
    success: true,
    bikeWorkouts: rows,
    athleteFtpWatts: athlete?.ftpWatts ?? null,
  });
}

/**
 * POST /api/bike-workouts — create bike workout + steps.
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

  if (typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const steps = parseSteps(body.steps);
  if (!steps) {
    return NextResponse.json(
      { error: "steps must be a non-empty array of step objects" },
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
    return NextResponse.json({ error: "description must be a string or null" }, { status: 400 });
  }

  const date = parseOptionalWorkoutDate(body.date);
  const ftpWattsSnapshot =
    typeof body.ftpWattsSnapshot === "number" && Number.isFinite(body.ftpWattsSnapshot)
      ? Math.round(body.ftpWattsSnapshot)
      : null;

  const estimatedDurationSeconds = steps.reduce((sum, s) => {
    const mult = s.repeatCount && s.repeatCount > 0 ? s.repeatCount : 1;
    if (s.durationType.trim().toUpperCase() === "OPEN") return sum;
    return sum + (s.durationSeconds ?? 0) * mult;
  }, 0);

  const notes =
    body.notes === null || body.notes === undefined
      ? null
      : typeof body.notes === "string"
        ? body.notes
        : null;
  if (body.notes != null && typeof body.notes !== "string") {
    return NextResponse.json({ error: "notes must be a string or null" }, { status: 400 });
  }

  const created = await prisma.bike_workout.create({
    data: {
      athleteId: resolved.athleteId,
      title: body.title.trim(),
      description,
      date: date ?? null,
      ftpWattsSnapshot,
      estimatedDurationSeconds: estimatedDurationSeconds > 0 ? estimatedDurationSeconds : null,
      notes,
      steps: {
        create: steps.map((s) => ({
          stepOrder: s.stepOrder,
          title: s.title,
          intensity: s.intensity,
          repeatCount: s.repeatCount ?? null,
          durationType: s.durationType,
          durationSeconds: s.durationSeconds ?? null,
          powerWattsLow: s.powerWattsLow ?? null,
          powerWattsHigh: s.powerWattsHigh ?? null,
          heartRateLow: s.heartRateLow ?? null,
          heartRateHigh: s.heartRateHigh ?? null,
          cadenceLow: s.cadenceLow ?? null,
          cadenceHigh: s.cadenceHigh ?? null,
          notes: s.notes ?? null,
        })),
      },
    },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });

  return NextResponse.json({ success: true, bikeWorkout: created });
}
