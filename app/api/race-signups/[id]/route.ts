export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  getAthleteRaceById,
  removeAthleteRaceWithSideEffects,
} from "@/lib/athlete-race-claim";

async function athleteFromRequest(request: NextRequest) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return { error: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  }
  return { athlete: auth.athlete };
}

/** PATCH /api/race-signups/[id] — legacy no-op; goal lives on athlete_races row. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { athlete, error } = await athleteFromRequest(request);
    if (error) return error;

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const athleteRace = await getAthleteRaceById({
      athleteId: athlete!.id,
      athleteRaceId: id,
    });
    if (!athleteRace) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ signup: athleteRace, athleteRace });
  } catch (err: unknown) {
    console.error("PATCH /api/race-signups/[id]:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}

/** DELETE /api/race-signups/[id] — @deprecated alias for DELETE /api/athlete-races/[id] */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { athlete, error } = await athleteFromRequest(request);
    if (error) return error;

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const deleteActivePlan =
      request.nextUrl.searchParams.get("deleteActivePlan") === "true";

    const result = await removeAthleteRaceWithSideEffects({
      athleteId: athlete!.id,
      athleteRaceId: id,
      deleteActivePlanIfTargeted: deleteActivePlan,
    });

    if (!result.ok) {
      if (result.reason === "active_plan_requires_confirmation") {
        return NextResponse.json(
          {
            error:
              "This race is tied to your active training plan. Confirm to delete the plan and remove the race.",
            trainingPlanId: result.trainingPlanId,
            requiresPlanDelete: true,
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("DELETE /api/race-signups/[id]:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}
