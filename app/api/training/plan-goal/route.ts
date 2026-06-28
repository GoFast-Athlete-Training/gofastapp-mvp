export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { serializePlanGoal } from "@/lib/training/plan-entity-serialize";
import { findGoalBySlug, upsertGoalBySlug } from "@/lib/training/plan-persona-goal";
import { normalizeSlug } from "@/lib/training/plan-entity-slugs";
import type {
  FitnessDelta,
  ProgressionAggressiveness,
  TrainingPlanGoalKind,
} from "@prisma/client";

function parseGoalKind(v: unknown): TrainingPlanGoalKind | null {
  if (v === "RACE" || v === "race") return "RACE";
  if (v === "TRAINING_BLOCK" || v === "trainingBlock") return "TRAINING_BLOCK";
  return null;
}

export async function GET(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const slug = request.nextUrl.searchParams.get("slug");
  if (slug?.trim()) {
    const row = await findGoalBySlug(slug);
    if (!row) {
      return NextResponse.json({ success: true, goal: null, matched: false });
    }
    return NextResponse.json({
      success: true,
      goal: serializePlanGoal(row),
      matched: true,
    });
  }

  const personaId = request.nextUrl.searchParams.get("personaId")?.trim();
  const goals = await prisma.training_plan_goal.findMany({
    where: personaId ? { personaId } : undefined,
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: { persona: true },
  });

  return NextResponse.json({
    success: true,
    goals: goals.map(serializePlanGoal),
  });
}

export async function POST(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const personaId = typeof body.personaId === "string" ? body.personaId.trim() : "";
    if (!personaId) {
      return NextResponse.json({ success: false, error: "personaId is required" }, { status: 400 });
    }

    const persona = await prisma.training_plan_persona.findUnique({ where: { id: personaId } });
    if (!persona) {
      return NextResponse.json({ success: false, error: "persona not found" }, { status: 404 });
    }

    const weeksRaw = body.planDurationWeeks;
    const planDurationWeeks =
      typeof weeksRaw === "number" && Number.isFinite(weeksRaw)
        ? Math.max(1, Math.round(weeksRaw))
        : null;
    if (planDurationWeeks == null) {
      return NextResponse.json(
        { success: false, error: "planDurationWeeks is required" },
        { status: 400 }
      );
    }

    const row = await upsertGoalBySlug({
      slug: typeof body.slug === "string" ? normalizeSlug(body.slug) : undefined,
      goalSlug: typeof body.goalSlug === "string" ? body.goalSlug : undefined,
      personaSlug: persona.slug,
      personaId,
      targetDistanceLabel:
        typeof body.targetDistanceLabel === "string" ? body.targetDistanceLabel : null,
      objectiveOfPlan:
        typeof body.objectiveOfPlan === "string" ? body.objectiveOfPlan : null,
      planDurationWeeks,
      timeHorizonLabel:
        typeof body.timeHorizonLabel === "string" ? body.timeHorizonLabel : null,
      goalKind: parseGoalKind(body.goalKind),
      coachIntent: typeof body.coachIntent === "string" ? body.coachIntent : null,
      fitnessDelta:
        typeof body.fitnessDelta === "string"
          ? (body.fitnessDelta.toUpperCase() as FitnessDelta)
          : null,
      progressionAggressiveness:
        typeof body.progressionAggressiveness === "string"
          ? (body.progressionAggressiveness.toUpperCase() as ProgressionAggressiveness)
          : null,
      intensityReasoning:
        typeof body.intensityReasoning === "string" ? body.intensityReasoning : null,
    });

    const withPersona = await prisma.training_plan_goal.findUnique({
      where: { id: row.id },
      include: { persona: true },
    });

    return NextResponse.json(
      {
        success: true,
        goal: serializePlanGoal(withPersona ?? { ...row, persona: persona }),
      },
      { status: 201 }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    }

    const existing = await prisma.training_plan_goal.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "goal not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if ("fitnessDelta" in body) {
      data.fitnessDelta =
        body.fitnessDelta == null
          ? null
          : typeof body.fitnessDelta === "string"
            ? (body.fitnessDelta.toUpperCase() as FitnessDelta)
            : null;
    }
    if ("progressionAggressiveness" in body) {
      data.progressionAggressiveness =
        body.progressionAggressiveness == null
          ? null
          : typeof body.progressionAggressiveness === "string"
            ? (body.progressionAggressiveness.toUpperCase() as ProgressionAggressiveness)
            : null;
    }
    if ("intensityReasoning" in body) {
      data.intensityReasoning =
        typeof body.intensityReasoning === "string" ? body.intensityReasoning.trim() : null;
    }
    if ("objectiveOfPlan" in body) {
      data.objectiveOfPlan =
        typeof body.objectiveOfPlan === "string" ? body.objectiveOfPlan.trim() : null;
    }
    if ("planDurationWeeks" in body && typeof body.planDurationWeeks === "number") {
      data.planDurationWeeks = Math.max(1, Math.round(body.planDurationWeeks));
    }

    const row = await prisma.training_plan_goal.update({
      where: { id },
      data,
      include: { persona: true },
    });

    return NextResponse.json({ success: true, goal: serializePlanGoal(row) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
