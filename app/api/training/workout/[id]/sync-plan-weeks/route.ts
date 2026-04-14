export const dynamic = "force-dynamic";

/**
 * POST /api/training/workout/[id]/sync-plan-weeks
 *
 * After a materialized workout row is edited (e.g. mileage or workoutType changed),
 * call this to push the change back into the parent plan's planWeeks JSON string so
 * the two stay in sync. planWeeks remains the source of truth for pre-materialized days.
 *
 * Auth: athlete bearer token (must own the workout).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { syncWorkoutToPlanWeeks } from "@/lib/training/plan-weeks-sync";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;

    const workout = await prisma.workouts.findFirst({
      where: { id, athleteId: auth.athlete.id, planId: { not: null } },
      select: { id: true, planId: true },
    });

    if (!workout) {
      return NextResponse.json(
        { error: "Workout not found or not part of a plan" },
        { status: 404 }
      );
    }

    await syncWorkoutToPlanWeeks(id);

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    console.error("POST /api/training/workout/[id]/sync-plan-weeks", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
