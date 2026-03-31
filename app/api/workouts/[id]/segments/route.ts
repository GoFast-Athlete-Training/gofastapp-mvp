export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { newEntityId } from "@/lib/training/new-entity-id";
import { Prisma } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

type SegmentInput = {
  stepOrder: number;
  title: string;
  durationType: string;
  durationValue: number;
  targets: Prisma.InputJsonValue | null;
  repeatCount: number | null;
  notes: string | null;
};

function normalizeSegments(raw: unknown): SegmentInput[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: SegmentInput[] = [];
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
    out.push({
      stepOrder,
      title,
      durationType,
      durationValue,
      targets,
      repeatCount,
      notes,
    });
  }
  return out;
}

/**
 * PUT /api/workouts/[id]/segments
 * Atomically replace all segments (prescribed only; clears lap actuals on new rows).
 */
export async function PUT(request: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id: workoutId } = await ctx.params;

    const workout = await prisma.workouts.findFirst({
      where: { id: workoutId, athleteId: auth.athlete.id },
    });

    if (!workout) {
      return NextResponse.json({ error: "Workout not found" }, { status: 404 });
    }

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

    await prisma.$transaction(async (tx) => {
      await tx.workout_segments.deleteMany({ where: { workoutId } });
      await tx.workout_segments.createMany({
        data: normalized.map((seg, index) => ({
          id: newEntityId(),
          workoutId,
          stepOrder: seg.stepOrder ?? index + 1,
          title: seg.title,
          durationType: seg.durationType === "TIME" ? "TIME" : "DISTANCE",
          durationValue: seg.durationValue,
          targets:
            seg.targets === null
              ? Prisma.DbNull
              : (seg.targets as Prisma.InputJsonValue),
          repeatCount: seg.repeatCount,
          notes: seg.notes,
        })),
      });
    });

    const updated = await prisma.workouts.findFirst({
      where: { id: workoutId, athleteId: auth.athlete.id },
      include: { segments: { orderBy: { stepOrder: "asc" } } },
    });

    return NextResponse.json({ workout: updated });
  } catch (error: unknown) {
    console.error("PUT /api/workouts/[id]/segments", error);
    return NextResponse.json(
      { error: "Failed to replace segments" },
      { status: 500 }
    );
  }
}
