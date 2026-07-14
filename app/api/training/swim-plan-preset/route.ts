export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import {
  parseSwimPresetFromBody,
  serializeSwimPresetForApi,
  swimPresetWriteToPrismaCreate,
} from "@/lib/training/swim-preset-api";

const swimPresetInclude = {
  persona: true,
  goal: { include: { persona: true } },
  enduranceConfig: {
    include: {
      positions: {
        orderBy: { cyclePosition: "asc" as const },
        include: {
          swim_workout_catalogue: {
            select: { id: true, name: true, workoutType: true, slug: true },
          },
        },
      },
    },
  },
  thresholdConfig: {
    include: {
      positions: {
        orderBy: { cyclePosition: "asc" as const },
        include: {
          swim_workout_catalogue: {
            select: { id: true, name: true, workoutType: true, slug: true },
          },
        },
      },
    },
  },
  powerConfig: {
    include: {
      positions: {
        orderBy: { cyclePosition: "asc" as const },
        include: {
          swim_workout_catalogue: {
            select: { id: true, name: true, workoutType: true, slug: true },
          },
        },
      },
    },
  },
  longSwimConfig: {
    include: {
      positions: {
        orderBy: { cyclePosition: "asc" as const },
        include: {
          swim_workout_catalogue: {
            select: { id: true, name: true, workoutType: true, slug: true },
          },
        },
      },
    },
  },
} as const;

export async function GET(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const presets = await prisma.swim_plan_preset.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      persona: true,
      goal: { include: { persona: true } },
      enduranceConfig: { select: { id: true, name: true, workoutType: true } },
      thresholdConfig: { select: { id: true, name: true, workoutType: true } },
      powerConfig: { select: { id: true, name: true, workoutType: true } },
      longSwimConfig: { select: { id: true, name: true, workoutType: true } },
    },
  });

  return NextResponse.json({
    success: true,
    presets: presets.map((p) => serializeSwimPresetForApi(p)),
  });
}

export async function POST(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const parsed = parseSwimPresetFromBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
    }

    const createData = swimPresetWriteToPrismaCreate(parsed.data);
    const preset = await prisma.swim_plan_preset.create({
      data: createData,
      include: swimPresetInclude,
    });

    return NextResponse.json({
      success: true,
      preset: serializeSwimPresetForApi(preset),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create swim preset";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
