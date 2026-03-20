export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/training/workout/[id]
 * Workout + segments (drill-down).
 */
export async function GET(request: NextRequest, context: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await context.params;

    const workout = await prisma.workouts.findFirst({
      where: { id, athleteId: auth.athlete.id },
      include: {
        segments: { orderBy: { stepOrder: "asc" } },
        training_plans: {
          select: { id: true, name: true, totalWeeks: true },
        },
      },
    });

    if (!workout) {
      return NextResponse.json({ error: "Workout not found" }, { status: 404 });
    }

    return NextResponse.json({ workout });
  } catch (e: unknown) {
    console.error("GET /api/training/workout/[id]", e);
    return NextResponse.json({ error: "Failed to load workout" }, { status: 500 });
  }
}
