export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  createGarminTrainingApiForAthlete,
  GarminApiError,
} from "@/lib/garmin-workouts/garmin-training-api";
import { GarminNotConnectedError, requireGarminTokenFresh } from "@/lib/domain-garmin";

/**
 * DELETE /api/garmin/workouts-bulk
 * Remove all GoFast-pushed workouts from Garmin Connect for the signed-in athlete
 * and clear garminWorkoutId / garminScheduleId on local rows.
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const athleteId = auth.athlete.id;
    const rows = await prisma.workouts.findMany({
      where: {
        athleteId,
        garminWorkoutId: { not: null },
      },
      select: {
        id: true,
        garminWorkoutId: true,
        garminScheduleId: true,
      },
    });

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, removed: 0, errors: [] });
    }

    const token = await requireGarminTokenFresh(athleteId);
    const client = createGarminTrainingApiForAthlete(athleteId, token);

    const errors: Array<{ workoutId: string; message: string }> = [];
    let removed = 0;

    for (const row of rows) {
      const garminWorkoutId = row.garminWorkoutId;
      if (garminWorkoutId == null) continue;

      try {
        if (row.garminScheduleId != null) {
          try {
            await client.deleteSchedule(row.garminScheduleId);
          } catch (e) {
            if (!(e instanceof GarminApiError && e.status === 404)) {
              throw e;
            }
          }
        }
        await client.deleteWorkout(garminWorkoutId);
        removed++;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        errors.push({ workoutId: row.id, message });
        console.error(`workouts-bulk delete ${row.id}:`, e);
      }
    }

    await prisma.workouts.updateMany({
      where: {
        athleteId,
        garminWorkoutId: { not: null },
      },
      data: {
        garminWorkoutId: null,
        garminScheduleId: null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      removed,
      total: rows.length,
      errors,
    });
  } catch (e) {
    if (e instanceof GarminNotConnectedError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("DELETE /api/garmin/workouts-bulk:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
