export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { Prisma } from "@prisma/client";
import {
  replacePrescribeSegmentsForAthlete,
  resolveWorkoutTargetForAthlete,
  type PrescribeSegmentInput,
} from "@/lib/training/workout-or-planned-resolve";

type Ctx = { params: Promise<{ id: string }> };

function normalizeRecoveryFields(o: Record<string, unknown>): {
  recoveryDurationType: string | null;
  recoveryDurationValue: number | null;
} {
  const raw = o.recoveryDurationType;
  if (raw === undefined || raw === null || raw === "") {
    return { recoveryDurationType: null, recoveryDurationValue: null };
  }
  const t = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (t === "NONE") {
    return { recoveryDurationType: "NONE", recoveryDurationValue: null };
  }
  if (t !== "DISTANCE" && t !== "TIME") {
    return { recoveryDurationType: null, recoveryDurationValue: null };
  }
  const vRaw = o.recoveryDurationValue;
  const v =
    typeof vRaw === "number" && Number.isFinite(vRaw)
      ? vRaw
      : vRaw != null && vRaw !== ""
        ? Number(vRaw)
        : NaN;
  if (!Number.isFinite(v) || v <= 0) {
    return { recoveryDurationType: null, recoveryDurationValue: null };
  }
  return { recoveryDurationType: t, recoveryDurationValue: v };
}

function normalizeSegments(raw: unknown): PrescribeSegmentInput[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: PrescribeSegmentInput[] = [];
  for (let i = 0; i < raw.length; i++) {
    const seg = raw[i];
    if (!seg || typeof seg !== "object") return null;
    const o = seg as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    if (!title) return null;
    const durationValue =
      typeof o.durationValue === "number" ? o.durationValue : Number(o.durationValue);
    if (!Number.isFinite(durationValue)) return null;
    const durationType = o.durationType === "TIME" ? "TIME" : "DISTANCE";
    const stepOrder =
      typeof o.stepOrder === "number" && Number.isFinite(o.stepOrder)
        ? o.stepOrder
        : i + 1;
    let repeatCount: number | null;
    if (o.repeatCount == null || o.repeatCount === "") {
      repeatCount = null;
    } else {
      const r = typeof o.repeatCount === "number" ? o.repeatCount : Number(o.repeatCount);
      repeatCount = Number.isFinite(r) && r > 0 ? Math.floor(r) : null;
    }
    const notes =
      o.notes == null
        ? null
        : typeof o.notes === "string"
          ? o.notes
          : null;
    const targets =
      o.targets === undefined || o.targets === null
        ? null
        : (o.targets as Prisma.InputJsonValue);
    const { recoveryDurationType, recoveryDurationValue } = normalizeRecoveryFields(o);
    out.push({
      stepOrder,
      title,
      durationType,
      durationValue,
      targets,
      repeatCount,
      notes,
      recoveryDurationType,
      recoveryDurationValue,
    });
  }
  return out;
}

async function loadSegmentsResponseWorkout(id: string, athleteId: string) {
  const target = await resolveWorkoutTargetForAthlete(id, athleteId);
  if (!target) return null;

  if (target.kind === "standalone") {
    return prisma.workouts.findFirst({
      where: { id: target.workoutId, athleteId },
      include: { segments: { orderBy: { stepOrder: "asc" } } },
    });
  }

  return prisma.planned_workouts.findFirst({
    where: { id: target.plannedWorkoutId, athleteId },
    include: { segments: { orderBy: { stepOrder: "asc" } } },
  });
}

/**
 * PUT /api/workouts/[id]/segments
 * Atomically replace all segments (prescribed only; clears lap actuals on new rows).
 * Plan days write to planned_workout_segments (and synced instance when spawned).
 */
export async function PUT(request: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id: workoutId } = await ctx.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const segmentsPayload = Array.isArray(body)
      ? body
      : body &&
          typeof body === "object" &&
          "segments" in body &&
          Array.isArray((body as { segments: unknown }).segments)
        ? (body as { segments: unknown[] }).segments
        : null;

    const normalized = normalizeSegments(segmentsPayload);
    if (!normalized) {
      return NextResponse.json(
        { error: "Provide a non-empty segments array with title and durationValue per row" },
        { status: 400 }
      );
    }

    const target = await replacePrescribeSegmentsForAthlete({
      id: workoutId,
      athleteId: auth.athlete.id,
      normalized,
    });

    if (!target) {
      return NextResponse.json({ error: "Workout not found" }, { status: 404 });
    }

    const updated = await loadSegmentsResponseWorkout(workoutId, auth.athlete.id);

    return NextResponse.json({ workout: updated });
  } catch (error: unknown) {
    console.error("PUT /api/workouts/[id]/segments", error);
    return NextResponse.json(
      { error: "Failed to replace segments" },
      { status: 500 }
    );
  }
}
