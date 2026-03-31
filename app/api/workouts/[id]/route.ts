export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { parseOptionalWorkoutDate } from "@/lib/training/workout-date-parse";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/workouts/[id]
 * Update title, description, date, estimatedDistanceInMeters (partial updates).
 */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await ctx.params;
    const existing = await prisma.workouts.findFirst({
      where: { id, athleteId: auth.athlete.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Workout not found" }, { status: 404 });
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const data: {
      title?: string;
      description?: string | null;
      date?: Date | null;
      estimatedDistanceInMeters?: number | null;
    } = {};

    if ("title" in body && body.title !== undefined) {
      if (typeof body.title !== "string" || !body.title.trim()) {
        return NextResponse.json({ error: "title must be a non-empty string" }, { status: 400 });
      }
      data.title = body.title.trim();
    }

    if ("description" in body) {
      if (body.description === null) {
        data.description = null;
      } else if (typeof body.description === "string") {
        data.description = body.description;
      } else {
        return NextResponse.json(
          { error: "description must be a string or null" },
          { status: 400 }
        );
      }
    }

    let dateChangeWarning: string | undefined;
    if ("date" in body) {
      if (body.date === null || body.date === "") {
        data.date = null;
        if (existing.planId != null && existing.date != null) {
          dateChangeWarning =
            "Date cleared for a plan-linked workout. Your plan calendar may no longer match this row until re-synced.";
        }
      } else {
        const d = parseOptionalWorkoutDate(body.date);
        if (!d) {
          return NextResponse.json({ error: "date must be YYYY-MM-DD or valid ISO datetime" }, { status: 400 });
        }
        data.date = d;
        if (
          existing.planId != null &&
          existing.date != null &&
          existing.date.getTime() !== d.getTime()
        ) {
          dateChangeWarning =
            "This workout is linked to a training plan. Changing the date may desync it from your plan calendar.";
        }
      }
    }

    if ("estimatedDistanceInMeters" in body) {
      const v = body.estimatedDistanceInMeters;
      if (v === null) {
        data.estimatedDistanceInMeters = null;
      } else if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
        data.estimatedDistanceInMeters = v;
      } else {
        return NextResponse.json(
          { error: "estimatedDistanceInMeters must be a non-negative number or null" },
          { status: 400 }
        );
      }
    }

    if (Object.keys(data).length === 0) {
      const workout = await prisma.workouts.findFirst({
        where: { id, athleteId: auth.athlete.id },
        include: { segments: { orderBy: { stepOrder: "asc" } } },
      });
      return NextResponse.json({ workout });
    }

    await prisma.workouts.update({
      where: { id },
      data,
    });

    const workout = await prisma.workouts.findFirst({
      where: { id, athleteId: auth.athlete.id },
      include: { segments: { orderBy: { stepOrder: "asc" } } },
    });

    return NextResponse.json({
      workout,
      ...(dateChangeWarning ? { dateChangeWarning } : {}),
    });
  } catch (error: unknown) {
    console.error("PATCH /api/workouts/[id]", error);
    return NextResponse.json({ error: "Failed to update workout" }, { status: 500 });
  }
}
