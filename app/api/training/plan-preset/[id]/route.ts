export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { serializePlanPresetForApi } from "@/lib/training/quality-percent";
import { computeBuildCoef } from "@/lib/training/cycle-pool";

const presetInclude = {
  volumeConstraints: true,
  workoutConfig: true,
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
} as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const { id } = await params;
  const preset = await prisma.training_plan_preset.findUnique({
    where: { id },
    include: presetInclude,
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
      "maxWeeklyMiles",
      "baseMiles",
      "peakMiles",
      "taperMiles",
      "buildCoef",
      "buildCoefSteps",
    ] as const;
    const volumeData: Record<string, unknown> = {};
    const vol = body.volume && typeof body.volume === "object" ? body.volume : body;
    const volRec = vol as Record<string, unknown>;

    for (const k of volKeys) {
      if (k in vol) {
        if (k === "maxWeeklyMiles") {
          const v = volRec.maxWeeklyMiles;
          if (v === null || v === "") {
            volumeData.maxWeeklyMiles = null;
          } else if (typeof v === "number" && Number.isFinite(v)) {
            volumeData.maxWeeklyMiles = Math.max(1, Math.round(v));
          }
        } else if (k === "buildCoefSteps") {
          /* only used to recompute buildCoef — not a DB column */
        } else {
          const v = volRec[k];
          if (v != null) {
            volumeData[k] = v;
          }
        }
      }
    }

    if (existing.volumeConstraints) {
      const cur = existing.volumeConstraints;
      const nextBase = volumeData.baseMiles != null ? Number(volumeData.baseMiles) : cur.baseMiles;
      const nextPeak = volumeData.peakMiles != null ? Number(volumeData.peakMiles) : cur.peakMiles;
      const hadStep =
        typeof volRec.buildCoefSteps === "number" && volRec.buildCoefSteps > 0
          ? Math.floor(volRec.buildCoefSteps)
          : null;
      const shouldRecomputeBuild =
        (volumeData.baseMiles != null || volumeData.peakMiles != null || hadStep != null) &&
        volumeData.buildCoef == null;
      if (shouldRecomputeBuild) {
        const steps = hadStep ?? 2;
        volumeData.buildCoef = computeBuildCoef(nextBase, nextPeak, steps);
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

    type ConnectKey = "longRunConfig" | "intervalsConfig" | "tempoConfig";
    const connectFields: { bodyKey: string; rel: ConnectKey; find: (x: string) => Promise<{ id: string } | null> }[] = [
      { bodyKey: "longRunConfigId", rel: "longRunConfig", find: (x) => prisma.long_run_config.findUnique({ where: { id: x } }) },
      {
        bodyKey: "intervalsConfigId",
        rel: "intervalsConfig",
        find: (x) => prisma.intervals_config.findUnique({ where: { id: x } }),
      },
      { bodyKey: "tempoConfigId", rel: "tempoConfig", find: (x) => prisma.tempo_config.findUnique({ where: { id: x } }) },
    ];
    for (const { bodyKey, rel, find } of connectFields) {
      if (bodyKey in body) {
        const v = (body as Record<string, unknown>)[bodyKey];
        if (v === null || v === "") {
          presetData[rel] = { disconnect: true };
        } else if (typeof v === "string") {
          const row = await find(v);
          if (!row) {
            return NextResponse.json(
              { success: false, error: `${bodyKey} is not a valid config` },
              { status: 400 }
            );
          }
          presetData[rel] = { connect: { id: v } };
        } else {
          return NextResponse.json(
            { success: false, error: `${bodyKey} must be a string, null, or empty` },
            { status: 400 }
          );
        }
      }
    }

    delete volumeData.buildCoefSteps;

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
      include: presetInclude,
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
