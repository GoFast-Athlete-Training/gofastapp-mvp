export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { normalizeTaperLongRuns } from "@/lib/training/preset-volume-helpers";
import {
  parseBoltonQualityToFraction,
  serializePlanPresetForApi,
} from "@/lib/training/quality-percent";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const { id } = await params;
  const preset = await prisma.training_plan_preset.findUnique({
    where: { id },
    include: {
      volumeConstraints: true,
      workoutConfig: true,
    },
  });
  if (!preset) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, preset });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const { id } = await params;

  try {
    const body = await request.json();

    const existing = await prisma.training_plan_preset.findUnique({
      where: { id },
      include: { volumeConstraints: true, workoutConfig: true },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    if (body.slug && body.slug !== existing.slug) {
      const conflict = await prisma.training_plan_preset.findFirst({
        where: { slug: body.slug, id: { not: id } },
      });
      if (conflict) {
        return NextResponse.json(
          { success: false, error: "Slug already in use" },
          { status: 409 }
        );
      }
    }

    const volKeys = [
      "taperWeeks",
      "peakWeeks",
      "taperLongRuns",
      "baseStartMiles",
      "ladderStep",
      "ladderCycleLen",
      "peakEntryMiles",
      "peakLongRunMiles",
      "cutbackWeekModulo",
      "weeklyMileageMultiplier",
      "taperMileageReduction",
      "longRunCapFraction",
      "minWeeklyMiles",
      "minLongMiles",
      "minEasyPerDayMiles",
      "minEasyWeekMiles",
    ] as const;
    const volumeData: Record<string, unknown> = {};
    const vol = body.volume && typeof body.volume === "object" ? body.volume : body;
    for (const k of volKeys) {
      if (k in vol && vol[k] != null) volumeData[k] = vol[k];
    }
    if ("taperWeeks" in volumeData || "taperLongRuns" in volumeData) {
      const tw =
        typeof volumeData.taperWeeks === "number"
          ? volumeData.taperWeeks
          : existing.volumeConstraints?.taperWeeks ?? 3;
      volumeData.taperLongRuns = normalizeTaperLongRuns(
        tw,
        volumeData.taperLongRuns ?? existing.volumeConstraints?.taperLongRuns
      );
    }

    const workoutData: Record<string, unknown> = {};
    const wk = body.workout && typeof body.workout === "object" ? body.workout : {};
    const wkRec = wk as Record<string, unknown>;
    if ("qualityPercent" in wkRec || "qualityFraction" in wkRec) {
      const q = parseBoltonQualityToFraction(wkRec);
      if (q != null) workoutData.qualityFraction = q;
    }
    const wkRest = [
      "qualitySessions",
      "tempoIdealDow",
      "intervalIdealDow",
      "longRunDefaultDow",
    ] as const;
    for (const k of wkRest) {
      if (k in wk && (wk as Record<string, unknown>)[k] != null) {
        workoutData[k] = (wk as Record<string, unknown>)[k];
      }
    }
    if ("qualityOnLongRun" in wk && typeof wk.qualityOnLongRun === "boolean") {
      workoutData.qualityOnLongRun = wk.qualityOnLongRun;
    }

    const presetData: Record<string, unknown> = {};
    if (typeof body.title === "string") presetData.title = body.title.trim();
    if (body.description === null) presetData.description = null;
    else if (typeof body.description === "string") presetData.description = body.description.trim() || null;
    if (typeof body.slug === "string") presetData.slug = body.slug.trim().toLowerCase();

    const updated = await prisma.training_plan_preset.update({
      where: { id },
      data: {
        ...presetData,
        ...(existing.volumeConstraints && Object.keys(volumeData).length > 0
          ? {
              volumeConstraints: {
                update: volumeData as object,
              },
            }
          : {}),
        ...(existing.workoutConfig && Object.keys(workoutData).length > 0
          ? {
              workoutConfig: {
                update: workoutData as object,
              },
            }
          : {}),
      },
      include: {
        volumeConstraints: true,
        workoutConfig: true,
      },
    });

    return NextResponse.json({ success: true, preset: serializePlanPresetForApi(updated) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("PATCH /api/training/plan-preset/[id]", e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const { id } = await params;

  const inUse = await prisma.training_plans.findFirst({ where: { presetId: id } });
  if (inUse) {
    return NextResponse.json(
      { success: false, error: "Preset is referenced by one or more training plans" },
      { status: 409 }
    );
  }

  await prisma.training_plan_preset.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
