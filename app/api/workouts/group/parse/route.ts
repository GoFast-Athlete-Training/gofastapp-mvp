import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { parseGroupWorkoutText } from "@/lib/group-workouts/parse-group-workout-text";

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

/** POST /api/workouts/group/parse */
export async function POST(request: NextRequest) {
  try {
    if (!(await verifyStaffBearer(request))) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const body = (await request.json().catch(() => ({}))) as {
      sourceText?: string;
      workoutType?: string;
    };
    const sourceText = typeof body.sourceText === "string" ? body.sourceText.trim() : "";
    if (!sourceText) {
      return NextResponse.json(
        { success: false, error: "sourceText is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const result = await parseGroupWorkoutText(sourceText, body.workoutType || "Intervals");
    return NextResponse.json({ success: true, ...result }, { headers: corsHeaders });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Parse failed";
    console.error("POST /api/workouts/group/parse:", error);
    return NextResponse.json({ success: false, error: message }, { status: 400, headers: corsHeaders });
  }
}
