export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  hasRunContextInput,
  normalizeRunContextTags,
  runRunAssessment,
} from "@/lib/training/run-assessment-service";

type Ctx = { params: Promise<{ id: string }> };

type Body = {
  contextTags?: unknown;
  contextNote?: unknown;
};

/**
 * POST /api/workouts/[id]/coach-feedback
 * Saves run context and generates coach feedback on demand.
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await ctx.params;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const contextTags = normalizeRunContextTags(body.contextTags);
  const contextNote =
    typeof body.contextNote === "string" ? body.contextNote.trim().slice(0, 2000) : null;

  if (!hasRunContextInput({ contextTags, contextNote })) {
    return NextResponse.json(
      { error: "Add at least one context tag or a note before requesting coach feedback" },
      { status: 400 }
    );
  }

  const workout = await prisma.workouts.findFirst({
    where: { id, athleteId: auth.athlete.id },
    select: { id: true, matchedActivityId: true },
  });

  if (!workout) {
    return NextResponse.json({ error: "Workout not found" }, { status: 404 });
  }

  if (!workout.matchedActivityId) {
    return NextResponse.json(
      { error: "Link a Garmin activity before requesting coach feedback" },
      { status: 400 }
    );
  }

  try {
    await prisma.workouts.update({
      where: { id: workout.id },
      data: {
        runContextTags: contextTags,
        runContextNote: contextNote,
        runContextUpdatedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const analysisJson = await runRunAssessment({
      workoutId: workout.id,
      athleteId: auth.athlete.id,
      context: { contextTags, contextNote },
    });

    const updated = await prisma.workouts.findFirst({
      where: { id: workout.id },
      select: {
        analysisJson: true,
        runContextTags: true,
        runContextNote: true,
        runContextUpdatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      analysisJson,
      runContextTags: updated?.runContextTags ?? contextTags,
      runContextNote: updated?.runContextNote ?? contextNote,
      runContextUpdatedAt: updated?.runContextUpdatedAt?.toISOString() ?? null,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Coach feedback failed";
    console.error("POST /api/workouts/[id]/coach-feedback", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
