export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";

/**
 * DELETE /api/garmin/workouts-bulk
 * Clear stack push stamps on planned plan days for the signed-in athlete.
 * We no longer store Garmin workout/schedule ids locally.
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const athleteId = auth.athlete.id;
    const result = await prisma.planned_workouts.updateMany({
      where: {
        athleteId,
        workoutPushed: true,
      },
      data: {
        workoutPushed: false,
        workoutEditedAfterPush: false,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      clearedPushStamps: result.count,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("DELETE /api/garmin/workouts-bulk:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
