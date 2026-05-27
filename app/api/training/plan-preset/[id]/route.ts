export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { serializePlanPresetForApi } from "@/lib/training/quality-percent";
import { parseTargetDistanceLabelFromBody } from "@/lib/training/preset-distance-match";
import {
  easyRunConfigToSnapshot,
  parseEasyRunConfigJson,
} from "@/lib/training/easy-run-config";
import { validatePresetRotationConfigs } from "@/lib/training/run-type-config-validation";

function isDow1to7(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 7;
}

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
      "maxWeeklyMiles",
      "baseMiles",
      "peakMiles",
      "taperMiles",
    ] as const;
    const scalarData: Record<string, unknown> = {};
    const bodyRec = body as Record<string, unknown>;

    for (const k of volKeys) {
      if (k in body) {
        if (k === "maxWeeklyMiles") {
          const v = bodyRec.maxWeeklyMiles;
          if (v === null || v === "") {
            scalarData.maxWeeklyMiles = null;
          } else if (typeof v === "number" && Number.isFinite(v)) {
            scalarData.maxWeeklyMiles = Math.max(1, Math.round(v));
          }
        } else if (k === "cycleLen") {
          const v = bodyRec.cycleLen;
          if (typeof v === "number" && Number.isFinite(v)) {
            const r = Math.round(v);
            if (r >= 1 && r <= 8) scalarData.cycleLen = r;
          }
        } else {
          const v = bodyRec[k];
          if (v != null) {
            scalarData[k] = v;
          }
        }
      }
    }

    const dowKeys = ["tempoIdealDow", "intervalIdealDow", "longRunDefaultDow"] as const;
    for (const k of dowKeys) {
      if (k in body && bodyRec[k] != null) {
        const n = bodyRec[k];
        if (typeof n === "number" && isDow1to7(n)) {
          scalarData[k] = n;
        }
      }
    }

    const presetData: Record<string, unknown> = {};
    if (typeof body.title === "string") presetData.title = body.title.trim();
    if (body.description === null) presetData.description = null;
    else if (typeof body.description === "string") presetData.description = body.description.trim() || null;
    if (body.publicDescription === null) presetData.publicDescription = null;
    else if (typeof body.publicDescription === "string")
      presetData.publicDescription = body.publicDescription.trim() || null;
    if (typeof body.slug === "string") presetData.slug = body.slug.trim().toLowerCase();

    const tdl = parseTargetDistanceLabelFromBody(body as Record<string, unknown>);
    if (!tdl.ok) {
      return NextResponse.json({ success: false, error: tdl.error }, { status: 400 });
    }
    if (tdl.value !== undefined) {
      presetData.targetDistanceLabel = tdl.value;
    }

    if ("easyRunConfig" in body) {
      const v = bodyRec.easyRunConfig;
      if (v === null) {
        presetData.easyRunConfig = Prisma.JsonNull;
      } else if (v !== undefined) {
        if (typeof v !== "object" || v === null || Array.isArray(v)) {
          return NextResponse.json(
            { success: false, error: "easyRunConfig must be an object or null" },
            { status: 400 }
          );
        }
        presetData.easyRunConfig = easyRunConfigToSnapshot(
          parseEasyRunConfigJson(v)
        ) as Prisma.InputJsonValue;
      }
    }

    type ConnectKey = "longRunConfig" | "intervalsConfig" | "tempoConfig" | "easyConfig";
    const connectFields: {
      bodyKey: string;
      rel: ConnectKey;
      find: (x: string) => Promise<{ id: string } | null>;
    }[] = [
      {
        bodyKey: "longRunConfigId",
        rel: "longRunConfig",
        find: (x) => prisma.long_run_config.findUnique({ where: { id: x } }),
      },
      {
        bodyKey: "intervalsConfigId",
        rel: "intervalsConfig",
        find: (x) => prisma.intervals_config.findUnique({ where: { id: x } }),
      },
      {
        bodyKey: "tempoConfigId",
        rel: "tempoConfig",
        find: (x) => prisma.tempo_config.findUnique({ where: { id: x } }),
      },
      {
        bodyKey: "easyConfigId",
        rel: "easyConfig",
        find: (x) => prisma.easy_config.findUnique({ where: { id: x } }),
      },
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

    function resolvedConfigId(bodyKey: string, currentId: string | null): string | null {
      if (!(bodyKey in body)) return currentId;
      const v = (body as Record<string, unknown>)[bodyKey];
      if (v === null || v === "") return null;
      return typeof v === "string" ? v : currentId;
    }

    const rotationPreset = {
      easyConfig: await (async () => {
        const cid = resolvedConfigId("easyConfigId", existing.easyConfigId);
        if (!cid) return null;
        return prisma.easy_config.findUnique({
          where: { id: cid },
          select: { name: true, positions: { select: { catalogueWorkoutId: true } } },
        });
      })(),
      longRunConfig: await (async () => {
        const cid = resolvedConfigId("longRunConfigId", existing.longRunConfigId);
        if (!cid) return null;
        return prisma.long_run_config.findUnique({
          where: { id: cid },
          select: { name: true, positions: { select: { catalogueWorkoutId: true } } },
        });
      })(),
      tempoConfig: await (async () => {
        const cid = resolvedConfigId("tempoConfigId", existing.tempoConfigId);
        if (!cid) return null;
        return prisma.tempo_config.findUnique({
          where: { id: cid },
          select: { name: true, positions: { select: { catalogueWorkoutId: true } } },
        });
      })(),
      intervalsConfig: await (async () => {
        const cid = resolvedConfigId("intervalsConfigId", existing.intervalsConfigId);
        if (!cid) return null;
        return prisma.intervals_config.findUnique({
          where: { id: cid },
          select: { name: true, positions: { select: { catalogueWorkoutId: true } } },
        });
      })(),
    };
    const rotationCheck = validatePresetRotationConfigs(rotationPreset);
    if (!rotationCheck.ok) {
      return NextResponse.json({ success: false, error: rotationCheck.error }, { status: 400 });
    }

    const updated = await prisma.training_plan_preset.update({
      where: { id },
      data: {
        ...presetData,
        ...scalarData,
      } as object,
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
