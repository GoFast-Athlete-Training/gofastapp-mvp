export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import type { AthletePersonaCapability, TrainingPlanGoalKind } from "@prisma/client";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { suggestPersonas } from "@/lib/training/plan-persona-suggest";

const CAPABILITIES = new Set([
  "NON_RUNNER",
  "BEGINNER",
  "RECREATIONAL",
  "COMPETITIVE",
  "ELITE",
]);

export async function GET(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const sp = request.nextUrl.searchParams;
  const capabilityRaw = sp.get("capability")?.trim().toUpperCase();
  const capability =
    capabilityRaw && CAPABILITIES.has(capabilityRaw)
      ? (capabilityRaw as AthletePersonaCapability)
      : null;

  const goalKindRaw = sp.get("goalKind")?.trim().toUpperCase();
  const goalKind: TrainingPlanGoalKind | null =
    goalKindRaw === "TRAINING_BLOCK" ? "TRAINING_BLOCK" : goalKindRaw === "RACE" ? "RACE" : null;

  const result = await suggestPersonas({
    capability,
    targetDistanceLabel: sp.get("targetDistanceLabel"),
    goalKind,
    personaGoalLabel: sp.get("personaGoalLabel"),
    suggestedSlug: sp.get("suggestedSlug"),
  });

  return NextResponse.json({ success: true, result });
}
