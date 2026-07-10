export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { PlanCustomWorkoutVisibility, WorkoutType } from "@prisma/client";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
/** Plan-scoped only — see lib/training/plan-custom-workout-policy.ts (no catalogue writes). */
import {
  createPlanCustomWorkout,
  listPlanCustomWorkouts,
} from "@/lib/training/public-training-plan-service";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/training-plan/[id]/custom-workouts */
export async function GET(request: NextRequest, context: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { id } = await context.params;
    const workouts = await listPlanCustomWorkouts(id, auth.athlete.id);
    return NextResponse.json({ success: true, workouts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load workouts";
    console.error("[custom-workouts GET]", err);
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

/** POST /api/training-plan/[id]/custom-workouts — plan-scoped athlete workout (not catalogue) */
export async function POST(request: NextRequest, context: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    const body = await request.json();
    const {
      weekNumber,
      dow,
      title,
      description,
      workoutType,
      content,
      leaderNotes,
      visibility,
    } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (!Number.isFinite(Number(weekNumber)) || !Number.isFinite(Number(dow))) {
      return NextResponse.json(
        { error: "weekNumber and dow are required" },
        { status: 400 }
      );
    }

    const vis =
      visibility &&
      Object.values(PlanCustomWorkoutVisibility).includes(visibility)
        ? visibility
        : PlanCustomWorkoutVisibility.PRIVATE;

    const wt =
      workoutType && Object.values(WorkoutType).includes(workoutType)
        ? workoutType
        : WorkoutType.Easy;

    const workout = await createPlanCustomWorkout({
      trainingPlanId: id,
      athleteId: auth.athlete.id,
      weekNumber: Number(weekNumber),
      dow: Number(dow),
      title,
      description,
      workoutType: wt,
      content,
      leaderNotes,
      visibility: vis,
    });

    return NextResponse.json({ success: true, workout });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create workout";
    console.error("[custom-workouts POST]", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
