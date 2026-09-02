import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { upsertRunPlannedWorkoutForRun } from "@/lib/run-planned-workouts/upsert-run-planned-workout";
import type { GroupWorkoutSegmentInput } from "@/lib/group-workouts/types";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

/** POST /api/runs/[runId]/planned-workout — upsert scheduled-run prescribe template */
export async function POST(request: NextRequest, context: Ctx) {
  try {
    if (!(await verifyStaffBearer(request))) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    const { runId } = await context.params;
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
      { headers: corsHeaders }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Create failed";
    console.error("POST /api/runs/[runId]/planned-workout:", error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 400, headers: corsHeaders }
    );
  }
}
