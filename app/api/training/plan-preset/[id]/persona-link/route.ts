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
  const personaId = typeof body.personaId === "string" ? body.personaId.trim() : "";
  if (!personaId) {
    return NextResponse.json({ success: false, error: "personaId is required" }, { status: 400 });
  }

  const [preset, persona] = await Promise.all([
    prisma.training_plan_preset.findUnique({ where: { id: presetId } }),
    prisma.training_plan_persona.findUnique({ where: { id: personaId } }),
  ]);
  if (!preset) {
    return NextResponse.json({ success: false, error: "Preset not found" }, { status: 404 });
  }
  if (!persona) {
    return NextResponse.json({ success: false, error: "Persona not found" }, { status: 404 });
  }

  const updated = await prisma.training_plan_preset.update({
    where: { id: presetId },
    data: { personaId },
    include: { persona: true, goal: { include: { persona: true } } },
  });

  if (updated.goalId) {
    await prisma.training_plan_goal.update({
      where: { id: updated.goalId },
      data: { personaId },
    });
  }

  return NextResponse.json({
    success: true,
    preset: attachEntityFields(serializePlanPresetForApi(updated), {
      persona: updated.persona ?? null,
      goal: updated.goal ?? null,
    }),
  });
}
