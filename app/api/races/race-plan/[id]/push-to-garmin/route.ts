export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { pushRacePlanToGarminForAthlete } from "@/lib/garmin-workouts/push-race-plan-for-athlete";

/** POST — encode race plan splits and schedule on Garmin race date. */
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
    const result = await pushRacePlanToGarminForAthlete(auth.athlete.id, id);

    if (!result.ok) {
      if (result.code === "not_found") {
        return NextResponse.json({ error: result.message }, { status: 404 });
      }
      if (result.code === "no_blocks") {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      if (result.code === "garmin_disconnected") {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      return NextResponse.json(
        { error: result.message, status: result.garminStatus ?? 502 },
        { status: result.garminStatus ?? 502 }
      );
    }

    return NextResponse.json({
      success: true,
      racePlanId: result.racePlanId,
      scheduledDate: result.scheduledDate,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    console.error("POST /api/races/race-plan/push-to-garmin", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
