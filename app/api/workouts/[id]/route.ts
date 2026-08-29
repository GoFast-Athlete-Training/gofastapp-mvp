export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { parseOptionalWorkoutDate } from "@/lib/training/workout-date-parse";
import {
  applyPrescribePatchForAthlete,
  resolveWorkoutTargetForAthlete,
  type PrescribePatchData,
} from "@/lib/training/workout-or-planned-resolve";

type Ctx = { params: Promise<{ id: string }> };

function parsePatchBody(body: Record<string, unknown>): {
  data: PrescribePatchData;
  error?: NextResponse;
} {
  const data: PrescribePatchData = {};

  if ("title" in body && body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      return {
        data,
        error: NextResponse.json({ error: "title must be a non-empty string" }, { status: 400 }),
      };
    }
    data.title = body.title.trim();
  }

  if ("description" in body) {
    if (body.description === null) {
      data.description = null;
    } else if (typeof body.description === "string") {
      data.description = body.description;
    } else {
      return {
        data,
        error: NextResponse.json(
          { error: "description must be a string or null" },
          { status: 400 }
        ),
      };
    }
  }

  if ("date" in body) {
    if (body.date === null || body.date === "") {
      data.date = null;
    } else {
      const d = parseOptionalWorkoutDate(body.date);
      if (!d) {
        return {
          data,
          error: NextResponse.json(
            { error: "date must be YYYY-MM-DD or valid ISO datetime" },
            { status: 400 }
          ),
        };
      }
      data.date = d;
    }
  }

  if ("estimatedDistanceInMeters" in body) {
    const v = body.estimatedDistanceInMeters;
    if (v === null) {
      data.estimatedDistanceInMeters = null;
    } else if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      data.estimatedDistanceInMeters = v;
    } else {
      return {
        data,
        error: NextResponse.json(
          { error: "estimatedDistanceInMeters must be a non-negative number or null" },
          { status: 400 }
        ),
      };
    }
  }

  return { data };
}

function planDateChangeWarning(params: {
  planId: string | null;
  existingDate: Date | null;
  nextDate: Date | null | undefined;
  clearing: boolean;
}): string | undefined {
  if (params.planId == null || params.existingDate == null) return undefined;
  if (params.clearing) {
    return "Date cleared for a plan-linked workout. Your plan calendar may no longer match this row until re-synced.";
  }
  if (params.nextDate != null && params.existingDate.getTime() !== params.nextDate.getTime()) {
    return "This workout is linked to a training plan. Changing the date may desync it from your plan calendar.";
  }
  return undefined;
}

async function loadPatchResponseWorkout(id: string, athleteId: string) {
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
 * PATCH /api/workouts/[id]
 * Update title, description, date, estimatedDistanceInMeters (partial updates).
 * Plan calendar days write to planned_workouts (and synced instance when spawned).
 */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await ctx.params;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = parsePatchBody(body);
    if (parsed.error) return parsed.error;

    const target = await resolveWorkoutTargetForAthlete(id, auth.athlete.id);
    if (!target) {
      return NextResponse.json({ error: "Workout not found" }, { status: 404 });
    }

    let dateChangeWarning: string | undefined;
    if ("date" in body) {
      if (target.kind === "planned" && (body.date === null || body.date === "")) {
        return NextResponse.json(
          { error: "date cannot be cleared for a planned workout" },
          { status: 400 }
        );
      }

      const existingRow =
        target.kind === "planned"
          ? await prisma.planned_workouts.findFirst({
              where: { id: target.plannedWorkoutId, athleteId: auth.athlete.id },
              select: { planId: true, date: true },
            })
          : await prisma.workouts.findFirst({
              where: { id: target.workoutId, athleteId: auth.athlete.id },
              select: { planId: true, date: true },
            });

      dateChangeWarning = planDateChangeWarning({
        planId: existingRow?.planId ?? null,
        existingDate: existingRow?.date ?? null,
        nextDate: parsed.data.date,
        clearing: body.date === null || body.date === "",
      });
    }

    const patchData = { ...parsed.data };
    if (target.kind === "planned" && patchData.description !== undefined) {
      delete patchData.description;
    }

    if (Object.keys(patchData).length === 0) {
      const workout = await loadPatchResponseWorkout(id, auth.athlete.id);
      return NextResponse.json({ workout });
    }

    const applied = await applyPrescribePatchForAthlete({
      id,
      athleteId: auth.athlete.id,
      data: patchData,
    });
    if (!applied) {
      return NextResponse.json({ error: "Workout not found" }, { status: 404 });
    }

    const workout = await loadPatchResponseWorkout(id, auth.athlete.id);

    return NextResponse.json({
      workout,
      ...(dateChangeWarning ? { dateChangeWarning } : {}),
    });
  } catch (error: unknown) {
    console.error("PATCH /api/workouts/[id]", error);
    return NextResponse.json({ error: "Failed to update workout" }, { status: 500 });
  }
}
