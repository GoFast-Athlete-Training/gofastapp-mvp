export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { resolvePaceForPace } from "@/lib/training/resolve-pace-for-pace";
import {
  derivePaceForPaceStatus,
  paceForPaceStatusLabel,
} from "@/lib/training/pace-for-pace-status";
import { loadWorkoutForAnalysis } from "@/lib/training/load-workout-analysis";

/**
 * POST /api/training/pace-for-pace
 * Explicit off-ramp: resolve match + segment bolt + return analysis or real error.
 * Body: { workoutId?: string, activityId?: string }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const workoutId =
    body &&
    typeof body === "object" &&
    "workoutId" in body &&
    typeof (body as { workoutId: unknown }).workoutId === "string"
      ? (body as { workoutId: string }).workoutId.trim()
      : null;
  const activityId =
    body &&
    typeof body === "object" &&
    "activityId" in body &&
    typeof (body as { activityId: unknown }).activityId === "string"
      ? (body as { activityId: string }).activityId.trim()
      : null;

  if (!workoutId && !activityId) {
    return NextResponse.json(
      { error: "Provide workoutId or activityId" },
      { status: 400 }
    );
  }

  const result = await resolvePaceForPace({
    athleteId: auth.athlete.id,
    workoutId,
    activityId,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: result.code,
        message: result.message,
        workoutId: result.workoutId ?? null,
        activityId: result.activityId ?? null,
        matchCandidates: result.matchCandidates ?? null,
      },
      { status: result.code === "NOT_FOUND" ? 404 : 422 }
    );
  }

  return NextResponse.json({
    ok: true,
    workoutId: result.workoutId,
    activityId: result.activityId,
    paceForPaceStatus: result.paceForPaceStatus,
    paceForPaceStatusLabel: paceForPaceStatusLabel(result.paceForPaceStatus),
    message: result.message,
    performanceAnalysis: result.performanceAnalysis,
    workout: {
      id: result.workout.id,
      title: result.workout.title,
      workoutType: result.workout.workoutType,
      matchedActivityId: result.workout.matchedActivityId,
      segmentExecutionStatus: result.workout.segmentExecutionStatus,
    },
  });
}

/**
 * GET /api/training/pace-for-pace?workoutId=
 * Read current Pace for Pace status without re-running analysis.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const workoutId = new URL(request.url).searchParams.get("workoutId")?.trim();
  if (!workoutId) {
    return NextResponse.json({ error: "workoutId required" }, { status: 400 });
  }

  const loaded = await loadWorkoutForAnalysis({
    workoutId,
    athleteId: auth.athlete.id,
  });

  if (!loaded) {
    return NextResponse.json({ error: "Workout not found" }, { status: 404 });
  }

  const statusResult = derivePaceForPaceStatus(
    loaded.analysisInput,
    loaded.performanceAnalysis
  );

  return NextResponse.json({
    workoutId,
    paceForPaceStatus: statusResult.status,
    paceForPaceStatusLabel: paceForPaceStatusLabel(statusResult.status),
    message: statusResult.message,
    failureReason: statusResult.failureReason,
    performanceAnalysis: loaded.performanceAnalysis,
  });
}
