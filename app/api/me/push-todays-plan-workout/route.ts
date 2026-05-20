export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { materializeTodayPlanWorkoutForAthlete } from "@/lib/training/materialize-todays-plan-workout";
import { pushWorkoutToGarminForAthlete } from "@/lib/garmin-workouts/push-workout-for-athlete";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/me/push-todays-plan-workout
 * Materialize today's plan session, then push to Garmin (manual when cron missed).
 */
export async function POST(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const athleteId = auth.athlete.id;

  const materialized = await materializeTodayPlanWorkoutForAthlete(athleteId);
  if (materialized.status === "no_active_plan") {
    return NextResponse.json(
      { error: "No active training plan with a schedule." },
      { status: 404 }
    );
  }
  if (materialized.status === "no_session_today") {
    return NextResponse.json(
      { error: "No workout scheduled for today." },
      { status: 404 }
    );
  }
  if (materialized.status === "error") {
    return NextResponse.json({ error: materialized.message }, { status: 400 });
  }

  const workoutId = materialized.workoutId;
  const segCount = await prisma.workout_segments.count({
    where: { workoutId },
  });
  if (segCount === 0) {
    return NextResponse.json(
      {
        error:
          "Today's workout has no structured steps yet. Open session detail first, then try again.",
      },
      { status: 400 }
    );
  }

  const pushed = await pushWorkoutToGarminForAthlete(athleteId, workoutId);
  if (!pushed.ok) {
    const status =
      pushed.code === "garmin_disconnected"
        ? 400
        : pushed.code === "not_found"
          ? 404
          : 502;
    return NextResponse.json(
      { error: pushed.message, code: pushed.code },
      { status }
    );
  }

  return NextResponse.json({
    ok: true,
    workoutId,
    garminWorkoutId: pushed.garminWorkoutId,
    garminScheduleId: pushed.garminScheduleId,
    scheduledDate: pushed.scheduledDate,
  });
}
