export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  hasRunContextInput,
  normalizeRunContextTags,
  runRunAssessment,
} from "@/lib/training/run-assessment-service";
import { loadPlannedWorkoutDetailForAthlete } from "@/lib/training/planned-workout-detail";
import {
  resolveInstanceWorkoutIdForAthlete,
  resolveWorkoutTargetForAthlete,
} from "@/lib/training/workout-or-planned-resolve";

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

  const target = await resolveWorkoutTargetForAthlete(id, auth.athlete.id);
  if (!target) {
    return NextResponse.json({ error: "Workout not found" }, { status: 404 });
  }

  let workoutId: string | null = null;
  let garminDetailActivityId: string | null = null;

  if (target.kind === "standalone") {
    const workout = await prisma.workouts.findFirst({
      where: { id: target.workoutId, athleteId: auth.athlete.id },
      select: { id: true, garminDetailActivityId: true },
    });
    workoutId = workout?.id ?? null;
    garminDetailActivityId = workout?.garminDetailActivityId ?? null;
  } else {
    const detail = await loadPlannedWorkoutDetailForAthlete({
      plannedWorkoutId: target.plannedWorkoutId,
      athleteId: auth.athlete.id,
    });
    if (detail) {
      garminDetailActivityId = detail.garminDetailActivityId;
      workoutId =
        detail.garminDetailActivityId != null
          ? await resolveInstanceWorkoutIdForAthlete(id, auth.athlete.id, {
              spawnIfPlanned: true,
            })
          : null;
    }
  }

  if (!workoutId) {
    return NextResponse.json({ error: "Workout not found" }, { status: 404 });
  }

  if (!garminDetailActivityId) {
    return NextResponse.json(
      { error: "Link a Garmin activity before requesting coach feedback" },
      { status: 400 }
    );
  }

  try {
    await prisma.workouts.update({
      where: { id: workoutId },
      data: {
        runContextTags: contextTags,
        runContextNote: contextNote,
        runContextUpdatedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const analysisJson = await runRunAssessment({
      workoutId,
      athleteId: auth.athlete.id,
      context: { contextTags, contextNote },
    });

    const updated = await prisma.workouts.findFirst({
      where: { id: workoutId },
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
