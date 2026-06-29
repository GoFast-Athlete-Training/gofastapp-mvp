export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { serializePlanPersona } from "@/lib/training/plan-entity-serialize";
import { findPersonaBySlug, upsertPersonaBySlug } from "@/lib/training/plan-persona-goal";
import { normalizeSlug } from "@/lib/training/plan-entity-slugs";
import type { AthletePersonaCapability, AthletePersonaDedication } from "@prisma/client";

export async function GET(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const slug = request.nextUrl.searchParams.get("slug");
  if (slug?.trim()) {
    const row = await findPersonaBySlug(slug);
    if (!row) {
      return NextResponse.json({ success: true, persona: null, matched: false });
    }
    return NextResponse.json({
      success: true,
      persona: serializePlanPersona(row),
      matched: true,
    });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim().toLowerCase();
  const personas = await prisma.training_plan_persona.findMany({
    orderBy: { updatedAt: "desc" },
    take: q ? 50 : 200,
    ...(q
      ? {
          where: {
            OR: [
              { slug: { contains: q } },
              { title: { contains: q, mode: "insensitive" as const } },
            ],
          },
        }
      : {}),
  });

  return NextResponse.json({
    success: true,
    personas: personas.map(serializePlanPersona),
  });
}

export async function POST(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ success: false, error: "title is required" }, { status: 400 });
    }

    const capability =
      typeof body.capability === "string"
        ? (body.capability.trim().toUpperCase() as AthletePersonaCapability)
        : null;
    const dedication =
      typeof body.dedication === "string"
        ? (body.dedication.trim().toUpperCase() as AthletePersonaDedication)
        : null;

    const slugOverride = typeof body.slug === "string" ? normalizeSlug(body.slug) : "";

    const row = await upsertPersonaBySlug({
      slug: slugOverride || undefined,
      personaSlug: typeof body.personaSlug === "string" ? body.personaSlug : undefined,
      title,
      capability,
      dedication,
      personaGoalLabel:
        typeof body.personaGoalLabel === "string"
          ? body.personaGoalLabel
          : typeof body.athletePersonaGoal === "string"
            ? body.athletePersonaGoal
            : null,
      intentSummary: typeof body.intentSummary === "string" ? body.intentSummary : null,
      athletePersonaSummary:
        typeof body.athletePersonaSummary === "string" ? body.athletePersonaSummary : null,
      workoutFrequencyCap:
        typeof body.workoutFrequencyCap === "number" ? body.workoutFrequencyCap : null,
      runningHistory: typeof body.runningHistory === "string" ? body.runningHistory : null,
      runningHistorySummary:
        typeof body.runningHistorySummary === "string" ? body.runningHistorySummary : null,
      currentCapability:
        typeof body.currentCapability === "string" ? body.currentCapability : null,
      currentCapabilitySummary:
        typeof body.currentCapabilitySummary === "string" ? body.currentCapabilitySummary : null,
      injuryAssessment: typeof body.injuryAssessment === "string" ? body.injuryAssessment : null,
      injuryAssessmentSummary:
        typeof body.injuryAssessmentSummary === "string" ? body.injuryAssessmentSummary : null,
      dedicationText: typeof body.dedicationText === "string" ? body.dedicationText : null,
      dedicationSummary:
        typeof body.dedicationSummary === "string" ? body.dedicationSummary : null,
      abilityToTrain: typeof body.abilityToTrain === "string" ? body.abilityToTrain : null,
      abilityToTrainSummary:
        typeof body.abilityToTrainSummary === "string" ? body.abilityToTrainSummary : null,
      estimated5kTimeSeconds:
        typeof body.estimated5kTimeSeconds === "number" ? body.estimated5kTimeSeconds : null,
      estimated5kPerformanceSummary:
        typeof body.estimated5kPerformanceSummary === "string"
          ? body.estimated5kPerformanceSummary
          : null,
      estimated5kPerformanceRationale:
        typeof body.estimated5kPerformanceRationale === "string"
          ? body.estimated5kPerformanceRationale
          : null,
    });

    return NextResponse.json(
      { success: true, persona: serializePlanPersona(row) },
      { status: 201 }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
