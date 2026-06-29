export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { serializePlanPersona } from "@/lib/training/plan-entity-serialize";
import { normalizeSlug } from "@/lib/training/plan-entity-slugs";

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function intOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  return null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const { id } = await params;
  const existing = await prisma.training_plan_persona.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const data: Record<string, unknown> = {};

    if ("title" in body) data.title = str(body.title) ?? existing.title;
    if ("slug" in body) {
      const slug = normalizeSlug(typeof body.slug === "string" ? body.slug : "");
      if (!slug) {
        return NextResponse.json({ success: false, error: "Invalid slug" }, { status: 400 });
      }
      data.slug = slug;
    }
    if ("personaGoalLabel" in body || "athletePersonaGoal" in body) {
      data.personaGoalLabel = str(body.athletePersonaGoal) ?? str(body.personaGoalLabel);
    }
    if ("intentSummary" in body || "athletePersonaSummary" in body) {
      data.intentSummary = str(body.intentSummary) ?? str(body.athletePersonaSummary);
      data.athletePersonaSummary = str(body.athletePersonaSummary) ?? str(body.intentSummary);
    }

    const textFields = [
      "runningHistory",
      "runningHistorySummary",
      "currentCapability",
      "currentCapabilitySummary",
      "injuryAssessment",
      "injuryAssessmentSummary",
      "dedicationText",
      "dedicationSummary",
      "abilityToTrain",
      "abilityToTrainSummary",
      "estimated5kPerformanceSummary",
      "estimated5kPerformanceRationale",
    ] as const;
    for (const key of textFields) {
      if (key in body) data[key] = str(body[key]);
    }
    if ("estimated5kTimeSeconds" in body) {
      data.estimated5kTimeSeconds = intOrNull(body.estimated5kTimeSeconds);
    }
    if ("workoutFrequencyCap" in body) {
      data.workoutFrequencyCap = intOrNull(body.workoutFrequencyCap);
    }

    const row = await prisma.training_plan_persona.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, persona: serializePlanPersona(row) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
