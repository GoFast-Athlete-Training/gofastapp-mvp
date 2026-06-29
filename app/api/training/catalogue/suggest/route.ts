export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import type { WorkoutType } from "@prisma/client";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { suggestCatalogueWorkouts } from "@/lib/training/catalogue-suggest";

const WORKOUT_TYPES = new Set<WorkoutType>(["Easy", "LongRun", "Tempo", "Intervals"]);

export async function GET(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const sp = request.nextUrl.searchParams;
  const conceptSlug = sp.get("slug") ?? sp.get("conceptSlug") ?? "";
  const workoutTypeRaw = sp.get("workoutType") ?? "";
  if (!conceptSlug.trim() || !workoutTypeRaw.trim()) {
    return NextResponse.json(
      { success: false, error: "slug and workoutType are required" },
      { status: 400 }
    );
  }
  const workoutType = workoutTypeRaw.trim() as WorkoutType;
  if (!WORKOUT_TYPES.has(workoutType)) {
    return NextResponse.json({ success: false, error: "Invalid workoutType" }, { status: 400 });
  }

  const result = await suggestCatalogueWorkouts({
    conceptSlug,
    workoutType,
    intentSummary: sp.get("intent") ?? sp.get("intentSummary"),
  });

  return NextResponse.json({ success: true, result });
}
