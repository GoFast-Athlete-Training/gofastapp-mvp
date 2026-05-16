export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/training-plan/[id]/rematerialize-quality-segments
 * Clears materialized segments for Easy / Intervals / Tempo on this plan so the next
 * GET /api/training/workout/[id] lazy path rebuilds from catalogue.
 */
export async function POST(request: NextRequest, context: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id: planId } = await context.params;

    const plan = await prisma.training_plans.findFirst({
      where: { id: planId, athleteId: auth.athlete.id },
      select: { id: true },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const targetWorkouts = await prisma.workouts.findMany({
      where: {
        planId,
        athleteId: auth.athlete.id,
        workoutType: { in: ["Easy", "Intervals", "Tempo"] },
      },
      select: { id: true },
    });

    const workoutIds = targetWorkouts.map((w) => w.id);
    if (workoutIds.length === 0) {
      return NextResponse.json({
        ok: true,
        clearedWorkoutCount: 0,
        message: "No Easy, Intervals, or Tempo workouts on this plan.",
      });
    }

    await prisma.$transaction([
      prisma.workout_segments.deleteMany({
        where: { workoutId: { in: workoutIds } },
      }),
      prisma.workouts.updateMany({
        where: { id: { in: workoutIds } },
        data: {
          segmentSnapshotJson: Prisma.DbNull,
          updatedAt: new Date(),
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      clearedWorkoutCount: workoutIds.length,
    });
  } catch (e: unknown) {
    console.error("POST rematerialize-quality-segments", e);
    return NextResponse.json(
      { error: "Failed to rematerialize segments" },
      { status: 500 }
    );
  }
}
