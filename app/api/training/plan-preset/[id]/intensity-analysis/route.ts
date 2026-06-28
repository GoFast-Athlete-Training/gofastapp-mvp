export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { serializePlanGoal } from "@/lib/training/plan-entity-serialize";
import type { FitnessDelta, ProgressionAggressiveness } from "@prisma/client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const { id: presetId } = await params;

  try {
    const preset = await prisma.training_plan_preset.findUnique({
      where: { id: presetId },
      include: { goal: { include: { persona: true } }, persona: true },
    });
    if (!preset) {
      return NextResponse.json({ success: false, error: "Preset not found" }, { status: 404 });
    }
    if (!preset.goalId || !preset.goal) {
      return NextResponse.json(
        { success: false, error: "Preset has no linked goal — run Goal Setting first" },
        { status: 400 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;

    const fitnessDelta =
      typeof body.fitnessDelta === "string"
        ? (body.fitnessDelta.toUpperCase() as FitnessDelta)
        : body.fitnessDelta === undefined
          ? undefined
          : null;
    const progressionAggressiveness =
      typeof body.progressionAggressiveness === "string"
        ? (body.progressionAggressiveness.toUpperCase() as ProgressionAggressiveness)
        : body.progressionAggressiveness === undefined
          ? undefined
          : null;
    const intensityReasoning =
      typeof body.intensityReasoning === "string" ? body.intensityReasoning.trim() : undefined;

    const goal = await prisma.training_plan_goal.update({
      where: { id: preset.goalId },
      data: {
        ...(fitnessDelta !== undefined ? { fitnessDelta } : {}),
        ...(progressionAggressiveness !== undefined ? { progressionAggressiveness } : {}),
        ...(intensityReasoning !== undefined ? { intensityReasoning } : {}),
      },
      include: { persona: true },
    });

    return NextResponse.json({ success: true, goal: serializePlanGoal(goal) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const { id: presetId } = await params;
  const preset = await prisma.training_plan_preset.findUnique({
    where: { id: presetId },
    include: { goal: { include: { persona: true } } },
  });
  if (!preset?.goal) {
    return NextResponse.json({ success: false, error: "No goal linked" }, { status: 404 });
  }
  return NextResponse.json({ success: true, goal: serializePlanGoal(preset.goal) });
}
