export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  clearRaceGoal,
  getAthleteRaceGoalById,
  updateRaceGoal,
} from "@/lib/athlete-race-goal";

async function athleteFromRequest(request: NextRequest) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return { error: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  }
  return { athlete: auth.athlete };
}

/** GET /api/goals/[id] — id is athleteRaceId */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { athlete, error } = await athleteFromRequest(request);
    if (error) return error;
    const { id } = await params;

    const goal = await getAthleteRaceGoalById(athlete!.id, id);
    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }
    return NextResponse.json({ goal });
  } catch (err: unknown) {
    console.error("GET /api/goals/[id]:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}

/** PUT /api/goals/[id] — id is athleteRaceId */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { athlete, error } = await athleteFromRequest(request);
    if (error) return error;
    const { id } = await params;

    let body: {
      name?: string | null;
      description?: string | null;
      distance?: string;
      goalTime?: string | null;
      targetByDate?: string;
      raceRegistryId?: string | null;
      athleteRaceId?: string | null;
      status?: string;
      whyGoal?: string | null;
      successLooksLike?: string | null;
      completionFeeling?: string | null;
      motivationIcon?: string | null;
    } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const patch: Parameters<typeof updateRaceGoal>[2] = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.description !== undefined) patch.description = body.description;
    if (body.distance !== undefined) patch.distance = body.distance;
    if (body.goalTime !== undefined) patch.goalTime = body.goalTime;
    if (body.raceRegistryId !== undefined) patch.raceRegistryId = body.raceRegistryId;
    if (body.whyGoal !== undefined) patch.whyGoal = body.whyGoal;
    if (body.successLooksLike !== undefined) patch.successLooksLike = body.successLooksLike;
    if (body.completionFeeling !== undefined) patch.completionFeeling = body.completionFeeling;
    if (body.motivationIcon !== undefined) patch.motivationIcon = body.motivationIcon;

    try {
      const goal = await updateRaceGoal(id, athlete!.id, patch);
      if (!goal) {
        return NextResponse.json({ error: "Goal not found" }, { status: 404 });
      }
      return NextResponse.json({ goal });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Update failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  } catch (err: unknown) {
    console.error("PUT /api/goals/[id]:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}

/** DELETE /api/goals/[id] — clear goal fields on athlete race */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { athlete, error } = await athleteFromRequest(request);
    if (error) return error;
    const { id } = await params;

    const goal = await clearRaceGoal(id, athlete!.id);
    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }
    return NextResponse.json({ goal });
  } catch (err: unknown) {
    console.error("DELETE /api/goals/[id]:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}
