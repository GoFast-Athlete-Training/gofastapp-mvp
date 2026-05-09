export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { applyRunRecommendationFromWorkout } from "@/lib/training/apply-run-recommendation";

type Body = {
  workoutId?: string;
  field?: string;
  suggestedValue?: number;
};

/**
 * POST /api/me/apply-run-recommendation
 * Applies AI suggestion from workouts.analysisJson after user confirmation.
 */
export async function POST(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const workoutId = typeof body.workoutId === "string" ? body.workoutId.trim() : "";
  if (!workoutId) {
    return NextResponse.json({ error: "workoutId required" }, { status: 400 });
  }

  const field = body.field;
  if (field !== "aerobicCeilingBpm" && field !== "fiveKPaceSecPerMile") {
    return NextResponse.json(
      { error: "field must be aerobicCeilingBpm or fiveKPaceSecPerMile" },
      { status: 400 }
    );
  }

  const suggestedValue =
    typeof body.suggestedValue === "number" ? body.suggestedValue : Number(body.suggestedValue);
  if (!Number.isFinite(suggestedValue)) {
    return NextResponse.json({ error: "suggestedValue must be a number" }, { status: 400 });
  }

  const result = await applyRunRecommendationFromWorkout({
    workoutId,
    athleteId: auth.athlete.id,
    field,
    suggestedValue,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "Could not apply" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    updatedField: result.updatedField,
    summary: result.summary,
  });
}
