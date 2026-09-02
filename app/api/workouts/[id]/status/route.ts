export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  resolveInstanceWorkoutIdForAthlete,
  resolveWorkoutTargetForAthlete,
} from "@/lib/training/workout-or-planned-resolve";
import { loadPlannedWorkoutDetailForAthlete } from "@/lib/training/planned-workout-detail";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/workouts/[id]/status
 * Body: { status: "skipped", reason?: string } | { status: "planned" } to undo skip.
 * Plan days spawn an instance row when needed (skip state lives on workouts).
 */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await ctx.params;
    const target = await resolveWorkoutTargetForAthlete(id, auth.athlete.id);
    if (!target) {
      return NextResponse.json({ error: "Workout not found" }, { status: 404 });
    }

    let garminDetailActivityId: string | null = null;
    if (target.kind === "standalone") {
      const row = await prisma.workouts.findFirst({
        where: { id: target.workoutId, athleteId: auth.athlete.id },
        select: { garminDetailActivityId: true },
      });
      garminDetailActivityId = row?.garminDetailActivityId ?? null;
    } else {
      const detail = await loadPlannedWorkoutDetailForAthlete({
        plannedWorkoutId: target.plannedWorkoutId,
        athleteId: auth.athlete.id,
      });
      garminDetailActivityId = detail?.garminDetailActivityId ?? null;
    }

    if (garminDetailActivityId) {
      return NextResponse.json(
        { error: "Completed workouts cannot be marked skipped. Unlink the activity first." },
        { status: 400 }
      );
    }

    let body: { status?: string; reason?: string | null };
    try {
      body = (await request.json()) as { status?: string; reason?: string | null };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const status = typeof body.status === "string" ? body.status.trim() : "";
    if (status !== "skipped" && status !== "planned") {
      return NextResponse.json(
        { error: 'status must be "skipped" or "planned"' },
        { status: 400 }
      );
    }

    let skipReason: string | null = null;
    if (status === "skipped") {
      if ("reason" in body) {
        if (body.reason === null || body.reason === "") {
          skipReason = null;
        } else if (typeof body.reason === "string") {
          skipReason = body.reason.trim().slice(0, 500) || null;
        } else {
          return NextResponse.json({ error: "reason must be a string or null" }, { status: 400 });
        }
      }
    }

    const instanceId = await resolveInstanceWorkoutIdForAthlete(id, auth.athlete.id, {
      spawnIfPlanned: true,
    });
    if (!instanceId) {
      return NextResponse.json({ error: "Workout not found" }, { status: 404 });
    }

    const updated = await prisma.workouts.update({
      where: { id: instanceId },
      data:
        status === "skipped"
          ? {
              skippedAt: new Date(),
              skipReason,
              updatedAt: new Date(),
            }
          : {
              skippedAt: null,
              skipReason: null,
              updatedAt: new Date(),
            },
    });

    return NextResponse.json({
      success: true,
      workout: {
        id: updated.id,
        skippedAt: updated.skippedAt?.toISOString() ?? null,
        skipReason: updated.skipReason ?? null,
        garminDetailActivityId: updated.garminDetailActivityId,
      },
    });
  } catch (error: unknown) {
    console.error("PATCH /api/workouts/[id]/status", error);
    return NextResponse.json({ error: "Failed to update workout status" }, { status: 500 });
  }
}
