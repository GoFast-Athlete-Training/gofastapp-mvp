export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  clearPrimaryAthleteRace,
  setPrimaryAthleteRace,
} from "@/lib/athlete-primary-race";
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

/** GET /api/athlete-races/[id] — single athlete-owned race row */
export async function GET(
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

    return NextResponse.json({ athleteRace, signup: athleteRace });
  } catch (err: unknown) {
    console.error("GET /api/athlete-races/[id]:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}

/** PATCH /api/athlete-races/[id] — mark/unmark Goal race */
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

    const body = await request.json().catch(() => ({}));
    const isPrimaryRace = body.isPrimaryRace;

    if (isPrimaryRace === true) {
      const athleteRace = await setPrimaryAthleteRace({
        athleteId: athlete!.id,
        athleteRaceId: id,
      });
      return NextResponse.json({ athleteRace, signup: athleteRace });
    }

    if (isPrimaryRace === false) {
      const athleteRace = await clearPrimaryAthleteRace({
        athleteId: athlete!.id,
        athleteRaceId: id,
      });
      return NextResponse.json({ athleteRace, signup: athleteRace });
    }

    return NextResponse.json(
      { error: "isPrimaryRace true or false is required" },
      { status: 400 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Update failed";
    const status = msg.includes("not found") || msg.includes("Not the current") ? 404 : 500;
    console.error("PATCH /api/athlete-races/[id]:", err);
    return NextResponse.json({ error: msg }, { status });
  }
}

/** DELETE /api/athlete-races/[id] — remove claimed athlete race */
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
            activePlanId: result.activePlanId,
            requiresPlanDelete: true,
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("DELETE /api/athlete-races/[id]:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}
