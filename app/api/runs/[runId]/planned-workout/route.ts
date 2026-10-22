import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { assertAthleteHostsIndividualCityRun } from "@/lib/city-run/assert-athlete-hosts-city-run";
import { upsertRunPlannedWorkoutForRun } from "@/lib/run-planned-workouts/upsert-run-planned-workout";
import { clearRunPlannedWorkoutTemplate } from "@/lib/run-planned-workouts/clear-run-planned-workout";
import type { GroupWorkoutSegmentInput } from "@/lib/group-workouts/types";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type Ctx = { params: Promise<{ runId: string }> };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

async function verifyStaffBearer(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  try {
    await adminAuth.verifyIdToken(authHeader.substring(7));
    return true;
  } catch {
    return false;
  }
}

async function authorizeRunPlannedWorkoutWrite(
  request: NextRequest,
  cityRunId: string,
): Promise<{ ok: true; lane: "athlete" | "staff" } | { ok: false; response: NextResponse }> {
  const auth = await requireAthleteFromBearer(request);
  if (!("error" in auth)) {
    const host = await assertAthleteHostsIndividualCityRun(auth.athlete.id, cityRunId);
    if (!host.ok) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, error: host.error },
          { status: host.status, headers: corsHeaders },
        ),
      };
    }
    return { ok: true, lane: "athlete" };
  }

  if (await verifyStaffBearer(request)) {
    return { ok: true, lane: "staff" };
  }

  return {
    ok: false,
    response: NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status, headers: corsHeaders },
    ),
  };
}

/** POST /api/runs/[runId]/planned-workout — upsert scheduled-run prescribe template */
export async function POST(request: NextRequest, context: Ctx) {
  try {
    const { runId } = await context.params;
    const authz = await authorizeRunPlannedWorkoutWrite(request, runId);
    if (!authz.ok) return authz.response;

    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
      description?: string | null;
      workoutType?: string | null;
      date?: string;
      segments?: GroupWorkoutSegmentInput[];
    };

    const planned = await upsertRunPlannedWorkoutForRun({
      cityRunId: runId,
      title: body.title || "",
      description: body.description ?? null,
      workoutType: body.workoutType ?? "Intervals",
      date: body.date ? new Date(body.date) : new Date(),
      segments: Array.isArray(body.segments) ? body.segments : [],
    });

    return NextResponse.json(
      {
        success: true,
        plannedWorkout: {
          id: planned.id,
          title: planned.title,
          workoutType: planned.workoutType,
          segments: planned.segments,
        },
      },
      { headers: corsHeaders },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Create failed";
    console.error("POST /api/runs/[runId]/planned-workout:", error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 400, headers: corsHeaders },
    );
  }
}

/** DELETE /api/runs/[runId]/planned-workout — clear run instance template (host or staff) */
export async function DELETE(request: NextRequest, context: Ctx) {
  try {
    const { runId } = await context.params;
    const authz = await authorizeRunPlannedWorkoutWrite(request, runId);
    if (!authz.ok) return authz.response;

    await clearRunPlannedWorkoutTemplate(runId);

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Detach failed";
    console.error("DELETE /api/runs/[runId]/planned-workout:", error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 400, headers: corsHeaders },
    );
  }
}
