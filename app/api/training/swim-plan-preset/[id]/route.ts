export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import {
  parseSwimPresetFromBody,
  serializeSwimPresetForApi,
  swimPresetWriteToPrismaCreate,
  type SwimPresetWriteBody,
} from "@/lib/training/swim-preset-api";
import { Prisma } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

const swimPresetInclude = {
  persona: true,
  goal: { include: { persona: true } },
  enduranceConfig: {
    include: {
      positions: {
        orderBy: { cyclePosition: "asc" as const },
        include: { swim_workout_catalogue: true },
      },
    },
  },
  thresholdConfig: {
    include: {
      positions: {
        orderBy: { cyclePosition: "asc" as const },
        include: { swim_workout_catalogue: true },
      },
    },
  },
  powerConfig: {
    include: {
      positions: {
        orderBy: { cyclePosition: "asc" as const },
        include: { swim_workout_catalogue: true },
      },
    },
  },
  longSwimConfig: {
    include: {
      positions: {
        orderBy: { cyclePosition: "asc" as const },
        include: { swim_workout_catalogue: true },
      },
    },
  },
} as const;

export async function GET(request: NextRequest, context: RouteContext) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const { id } = await context.params;
  const preset = await prisma.swim_plan_preset.findUnique({
    where: { id },
    include: swimPresetInclude,
  });

  if (!preset) {
    return NextResponse.json({ success: false, error: "Swim preset not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    preset: serializeSwimPresetForApi(preset),
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = parseSwimPresetFromBody(body, { requireTitle: false });
    if (!parsed.ok) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }

    const existing = await prisma.swim_plan_preset.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Swim preset not found" }, { status: 404 });
    }

    const merged = {
      ...existing,
      title: parsed.data.title ?? existing.title,
      description: parsed.data.description ?? existing.description,
      publicDescription: parsed.data.publicDescription ?? existing.publicDescription,
      goalSwimDistanceMeters:
        parsed.data.goalSwimDistanceMeters ?? existing.goalSwimDistanceMeters,
      recommendationMultiplier:
        parsed.data.recommendationMultiplier ?? existing.recommendationMultiplier,
      recommendedWeeklyMeters:
        parsed.data.recommendedWeeklyMeters ?? existing.recommendedWeeklyMeters,
      minWeeklyMeters: parsed.data.minWeeklyMeters ?? existing.minWeeklyMeters,
      maxWeeklyMeters: parsed.data.maxWeeklyMeters ?? existing.maxWeeklyMeters,
      cycleLen: parsed.data.cycleLen ?? existing.cycleLen,
      weeklyProgressionPattern:
        parsed.data.weeklyProgressionPattern ?? existing.weeklyProgressionPattern,
      taperWeeks: parsed.data.taperWeeks ?? existing.taperWeeks,
      taperVolumeMultiplier:
        parsed.data.taperVolumeMultiplier ?? existing.taperVolumeMultiplier,
      longSwimShareOfWeek: parsed.data.longSwimShareOfWeek ?? existing.longSwimShareOfWeek,
      longSwimMinMeters: parsed.data.longSwimMinMeters ?? existing.longSwimMinMeters,
      longSwimMaxMeters: parsed.data.longSwimMaxMeters ?? existing.longSwimMaxMeters,
      workoutStructure: parsed.data.workoutStructure ?? existing.workoutStructure,
      enduranceIdealDow: parsed.data.enduranceIdealDow ?? existing.enduranceIdealDow,
      thresholdIdealDow: parsed.data.thresholdIdealDow ?? existing.thresholdIdealDow,
      powerIdealDow: parsed.data.powerIdealDow ?? existing.powerIdealDow,
      longSwimIdealDow: parsed.data.longSwimIdealDow ?? existing.longSwimIdealDow,
      personaId: parsed.data.personaId !== undefined ? parsed.data.personaId : existing.personaId,
      goalId: parsed.data.goalId !== undefined ? parsed.data.goalId : existing.goalId,
      enduranceConfigId:
        parsed.data.enduranceConfigId !== undefined
          ? parsed.data.enduranceConfigId
          : existing.enduranceConfigId,
      thresholdConfigId:
        parsed.data.thresholdConfigId !== undefined
          ? parsed.data.thresholdConfigId
          : existing.thresholdConfigId,
      powerConfigId:
        parsed.data.powerConfigId !== undefined
          ? parsed.data.powerConfigId
          : existing.powerConfigId,
      longSwimConfigId:
        parsed.data.longSwimConfigId !== undefined
          ? parsed.data.longSwimConfigId
          : existing.longSwimConfigId,
      coachIntent: parsed.data.coachIntent ?? existing.coachIntent,
      objectiveOfPlan: parsed.data.objectiveOfPlan ?? existing.objectiveOfPlan,
      athletePersonaCapability:
        parsed.data.athletePersonaCapability ?? existing.athletePersonaCapability,
      athletePersonaGoal: parsed.data.athletePersonaGoal ?? existing.athletePersonaGoal,
      athletePersonaDedication:
        parsed.data.athletePersonaDedication ?? existing.athletePersonaDedication,
      coachPlanOverview: parsed.data.coachPlanOverview ?? existing.coachPlanOverview,
      paceProfile: parsed.data.paceProfile ?? existing.paceProfile,
      slug: existing.slug,
    };

    const createShape = swimPresetWriteToPrismaCreate(merged as SwimPresetWriteBody);
    const {
      slug: _slug,
      persona: personaConnect,
      goal: goalConnect,
      enduranceConfig,
      thresholdConfig,
      powerConfig,
      longSwimConfig,
      ...scalarFields
    } = createShape;

    const data: Prisma.swim_plan_presetUpdateInput = {
      ...scalarFields,
      persona: personaConnect
        ? personaConnect
        : parsed.data.personaId === null
          ? { disconnect: true }
          : undefined,
      goal: goalConnect
        ? goalConnect
        : parsed.data.goalId === null
          ? { disconnect: true }
          : undefined,
      enduranceConfig: enduranceConfig
        ? enduranceConfig
        : parsed.data.enduranceConfigId === null
          ? { disconnect: true }
          : undefined,
      thresholdConfig: thresholdConfig
        ? thresholdConfig
        : parsed.data.thresholdConfigId === null
          ? { disconnect: true }
          : undefined,
      powerConfig: powerConfig
        ? powerConfig
        : parsed.data.powerConfigId === null
          ? { disconnect: true }
          : undefined,
      longSwimConfig: longSwimConfig
        ? longSwimConfig
        : parsed.data.longSwimConfigId === null
          ? { disconnect: true }
          : undefined,
    };

    const preset = await prisma.swim_plan_preset.update({
      where: { id },
      data,
      include: swimPresetInclude,
    });

    return NextResponse.json({
      success: true,
      preset: serializeSwimPresetForApi(preset),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update swim preset";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
