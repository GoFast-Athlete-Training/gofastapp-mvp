export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import type { WorkoutType } from "@prisma/client";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { suggestGoals } from "@/lib/training/plan-goal-suggest";
import type { TrainingPlanGoalType } from "@/lib/training/preset-realignment-types";

function parseGoalType(v: string | null): TrainingPlanGoalType | null {
  if (v === "RACE" || v === "GENERAL_FITNESS" || v === "MORE_ENDURANCE") return v;
  if (v === "race") return "RACE";
  return null;
}

export async function GET(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const sp = request.nextUrl.searchParams;
  const result = await suggestGoals({
    personaSlug: sp.get("personaSlug"),
    personaId: sp.get("personaId"),
    targetDistanceLabel: sp.get("targetDistanceLabel"),
    planDurationWeeks: sp.get("planDurationWeeks")
      ? Number(sp.get("planDurationWeeks"))
      : null,
    goalType: parseGoalType(sp.get("goalType")),
    suggestedSlug: sp.get("slug"),
  });

  return NextResponse.json({ success: true, result });
}
