import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { createGroupWorkout } from "@/lib/group-workouts/create-group-workout";
import type { GroupWorkoutSegmentInput } from "@/lib/group-workouts/types";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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

/** POST /api/workouts/group/create */
export async function POST(request: NextRequest) {
  try {
    if (!(await verifyStaffBearer(request))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const body = (await request.json().catch(() => ({}))) as {
      runClubId?: string;
      createdByStaffId?: string | null;
      title?: string;
      description?: string | null;
      workoutType?: string | null;
      segments?: GroupWorkoutSegmentInput[];
    };

    const workout = await createGroupWorkout({
      runClubId: body.runClubId || "",
      createdByStaffId: body.createdByStaffId ?? null,
      title: body.title || "",
      description: body.description ?? null,
      workoutType: body.workoutType ?? "Intervals",
      segments: Array.isArray(body.segments) ? body.segments : [],
    });

    return NextResponse.json(
      {
        success: true,
        workout: {
          id: workout.id,
          title: workout.title,
          workoutType: workout.workoutType,
          description: workout.description,
          scope: workout.scope,
          runClubId: workout.runClubId,
          segments: workout.segments,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Create failed";
    console.error("POST /api/workouts/group/create:", error);
    return NextResponse.json({ success: false, error: message }, { status: 400, headers: corsHeaders });
  }
}
