export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import {
  applyWorkoutPickerToPreset,
  type WorkoutPickerApplyInput,
} from "@/lib/training/apply-workout-picker";
import { attachEntityFields } from "@/lib/training/plan-entity-serialize";
import { serializePlanPresetForApi } from "@/lib/training/quality-percent";

const presetInclude = {
  longRunConfig: {
    include: {
      positions: {
        orderBy: { cyclePosition: "asc" as const },
        include: {
          workout_catalogue: {
            select: { id: true, name: true, workoutType: true, slug: true },
          },
        },
      },
    },
  },
  intervalsConfig: {
    include: {
      positions: {
        orderBy: { cyclePosition: "asc" as const },
        include: {
          workout_catalogue: {
            select: { id: true, name: true, workoutType: true, slug: true },
          },
        },
      },
    },
  },
  tempoConfig: {
    include: {
      positions: {
        orderBy: { cyclePosition: "asc" as const },
        include: {
          workout_catalogue: {
            select: { id: true, name: true, workoutType: true, slug: true },
          },
        },
      },
    },
  },
  easyConfig: {
    include: {
      positions: {
        orderBy: { cyclePosition: "asc" as const },
        include: {
          workout_catalogue: {
            select: { id: true, name: true, workoutType: true, slug: true },
          },
        },
      },
    },
  },
  persona: true,
  goal: { include: { persona: true } },
} as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const { id: presetId } = await params;

  try {
    const body = (await request.json()) as WorkoutPickerApplyInput;
    if (!body.longRun?.positions?.length || !body.easy?.positions?.length) {
      return NextResponse.json(
        { success: false, error: "longRun and easy positions are required" },
        { status: 400 }
      );
    }

    const configIds = await applyWorkoutPickerToPreset(presetId, body);

    const preset = await prisma.training_plan_preset.findUnique({
      where: { id: presetId },
      include: presetInclude,
    });

    if (!preset) {
      return NextResponse.json({ success: false, error: "Preset not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      configIds,
      preset: attachEntityFields(serializePlanPresetForApi(preset), {
        persona: preset.persona ?? null,
        goal: preset.goal ?? null,
      }),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
