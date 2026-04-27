export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { serializePlanPresetForApi } from "@/lib/training/quality-percent";

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
      runTypeConfig: {
        include: {
          positions: {
            orderBy: { cyclePosition: "asc" },
            include: {
              workout_catalogue: {
                select: { id: true, name: true, workoutType: true, slug: true },
              },
            },
          },
        },
      },
    },
  });
  if (!preset) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, preset: serializePlanPresetForApi(preset) });
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
      "cycleLen",
      "minWeeklyMiles",
      "minLongMiles",
      "minEasyPerDayMiles",
      "longRunWeekPct",
      "tempoWeekPct",
      "intervalsWeekPct",
      "cyclePoolBuildCoef",
      "cyclePoolTaperCoef",
    ] as const;
    const volumeData: Record<string, unknown> = {};
    const vol = body.volume && typeof body.volume === "object" ? body.volume : body;
    const volRec = vol as Record<string, unknown>;
    if ("longRunPeakPool" in volRec || "cyclePeakPool" in volRec) {
      const v =
        volRec.longRunPeakPool !== undefined ? volRec.longRunPeakPool : volRec.cyclePeakPool;
      if (v === null || v === "" || (typeof v === "number" && !Number.isFinite(v))) {
        if (existing.volumeConstraints?.longRunPeakPool != null) {
          volumeData.longRunPeakPool = existing.volumeConstraints.longRunPeakPool;
        }
      } else if (typeof v === "number" && v > 0) {
        volumeData.longRunPeakPool = v;
      }
    }
    for (const k of volKeys) {
      if (k in vol) {
        const v = volRec[k];
        if (v != null) {
          volumeData[k] = v;
        }
      }
    }

    const workoutData: Record<string, unknown> = {};
    const wk = body.workout && typeof body.workout === "object" ? body.workout : {};
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

    const presetData: Record<string, unknown> = {};
    if (typeof body.title === "string") presetData.title = body.title.trim();
    if (body.description === null) presetData.description = null;
    else if (typeof body.description === "string") presetData.description = body.description.trim() || null;
    if (typeof body.slug === "string") presetData.slug = body.slug.trim().toLowerCase();

    if ("runTypeConfigId" in body) {
      const v = (body as Record<string, unknown>).runTypeConfigId;
      if (v === null || v === "") {
        (presetData as { runTypeConfigId?: null }).runTypeConfigId = null;
      } else if (typeof v === "string") {
        const cfg = await prisma.run_type_config.findUnique({ where: { id: v } });
        if (!cfg) {
          return NextResponse.json(
            { success: false, error: "runTypeConfigId is not a valid run type config" },
            { status: 400 }
          );
        }
        (presetData as { runTypeConfigId?: string }).runTypeConfigId = v;
      } else {
        return NextResponse.json(
          { success: false, error: "runTypeConfigId must be a string, null, or empty" },
          { status: 400 }
        );
      }
    }

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
        runTypeConfig: {
          include: {
            positions: {
              orderBy: { cyclePosition: "asc" },
              include: {
                workout_catalogue: {
                  select: { id: true, name: true, workoutType: true, slug: true },
                },
              },
            },
          },
        },
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
