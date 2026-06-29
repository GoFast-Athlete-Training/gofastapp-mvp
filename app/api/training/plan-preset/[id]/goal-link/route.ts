export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { attachEntityFields } from "@/lib/training/plan-entity-serialize";
import { serializePlanPresetForApi } from "@/lib/training/quality-percent";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const { id: presetId } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const goalId = typeof body.goalId === "string" ? body.goalId.trim() : "";
  if (!goalId) {
    return NextResponse.json({ success: false, error: "goalId is required" }, { status: 400 });
  }

  const [preset, goal] = await Promise.all([
    prisma.training_plan_preset.findUnique({ where: { id: presetId } }),
    prisma.training_plan_goal.findUnique({ where: { id: goalId }, include: { persona: true } }),
  ]);
  if (!preset) {
    return NextResponse.json({ success: false, error: "Preset not found" }, { status: 404 });
  }
  if (!goal) {
    return NextResponse.json({ success: false, error: "Goal not found" }, { status: 404 });
  }

  const updated = await prisma.training_plan_preset.update({
    where: { id: presetId },
    data: {
      goalId,
      personaId: preset.personaId ?? goal.personaId,
      targetDistanceLabel: goal.targetDistanceLabel ?? preset.targetDistanceLabel,
    },
    include: { persona: true, goal: { include: { persona: true } } },
  });

  return NextResponse.json({
    success: true,
    preset: attachEntityFields(serializePlanPresetForApi(updated), {
      persona: updated.persona ?? null,
      goal: updated.goal ?? null,
    }),
  });
}
