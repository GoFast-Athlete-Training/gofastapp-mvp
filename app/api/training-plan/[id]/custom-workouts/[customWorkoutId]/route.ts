export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { PlanCustomWorkoutVisibility, WorkoutType } from "@prisma/client";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  deletePlanCustomWorkout,
  updatePlanCustomWorkout,
} from "@/lib/training/public-training-plan-service";

type Ctx = { params: Promise<{ id: string; customWorkoutId: string }> };

/** PATCH /api/training-plan/[id]/custom-workouts/[customWorkoutId] */
export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { customWorkoutId } = await context.params;
    const body = await request.json();

    const visibility =
      body.visibility &&
      Object.values(PlanCustomWorkoutVisibility).includes(body.visibility)
        ? body.visibility
        : undefined;
    const workoutType =
      body.workoutType && Object.values(WorkoutType).includes(body.workoutType)
        ? body.workoutType
        : undefined;

    const workout = await updatePlanCustomWorkout({
      customWorkoutId,
      athleteId: auth.athlete.id,
      weekNumber:
        body.weekNumber !== undefined ? Number(body.weekNumber) : undefined,
      dow: body.dow !== undefined ? Number(body.dow) : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
      description:
        body.description !== undefined ? body.description : undefined,
      workoutType,
      content: body.content,
      leaderNotes:
        body.leaderNotes !== undefined ? body.leaderNotes : undefined,
      visibility,
    });

    return NextResponse.json({ success: true, workout });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update workout";
    console.error("[custom-workouts PATCH]", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** DELETE /api/training-plan/[id]/custom-workouts/[customWorkoutId] */
export async function DELETE(request: NextRequest, context: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { customWorkoutId } = await context.params;
    await deletePlanCustomWorkout(customWorkoutId, auth.athlete.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete workout";
    console.error("[custom-workouts DELETE]", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
