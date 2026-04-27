export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { serializePlanPresetForApi } from "@/lib/training/quality-percent";
import { computeBuildCoef } from "@/lib/training/cycle-pool";

function slugifyPresetTitle(title: string): string {
  const s = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "preset";
}

function numPositive(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    return v;
  }
  return fallback;
}

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

export async function GET(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const presets = await prisma.training_plan_preset.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      volumeConstraints: true,
      workoutConfig: true,
      longRunConfig: { select: { id: true, name: true, description: true } },
      intervalsConfig: { select: { id: true, name: true, description: true } },
      tempoConfig: { select: { id: true, name: true, description: true } },
    },
  });
  return NextResponse.json({
    success: true,
    presets: presets.map(serializePlanPresetForApi),
  });
}

export async function POST(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const { slug: slugBody, title, description, volume, workout } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { success: false, error: "title is required" },
        { status: 400 }
      );
    }

    const slugRaw =
      typeof slugBody === "string" && slugBody.trim()
        ? slugBody.trim().toLowerCase()
        : slugifyPresetTitle(title);
    const slug = slugRaw.replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "") || slugifyPresetTitle(title);

    const existing = await prisma.training_plan_preset.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "A preset with this slug already exists" },
        { status: 409 }
      );
    }

    const vol = (volume && typeof volume === "object" ? volume : {}) as Record<string, unknown>;
    const wk = workout && typeof workout === "object" ? workout : {};
    const wkRec = wk as Record<string, unknown>;

    const peakMiles = numPositive(vol.peakMiles, 88);
    const defaultBase = peakMiles / (1.12 * 1.12);
    const baseMiles = numPositive(vol.baseMiles, defaultBase);
    const taperMiles = numPositive(vol.taperMiles, peakMiles * 0.85);
    const buildCoefSteps =
      typeof vol.buildCoefSteps === "number" && vol.buildCoefSteps > 0
        ? Math.floor(vol.buildCoefSteps)
        : 2;
    const buildCoef =
      typeof vol.buildCoef === "number" && Number.isFinite(vol.buildCoef) && vol.buildCoef > 0
        ? vol.buildCoef
        : computeBuildCoef(baseMiles, peakMiles, buildCoefSteps);

    let maxWeeklyMiles: number | null | undefined = undefined;
    if ("maxWeeklyMiles" in vol) {
      if (vol.maxWeeklyMiles === null || vol.maxWeeklyMiles === "") {
        maxWeeklyMiles = null;
      } else if (typeof vol.maxWeeklyMiles === "number" && Number.isFinite(vol.maxWeeklyMiles)) {
        maxWeeklyMiles = Math.max(1, Math.round(vol.maxWeeklyMiles));
      }
    }

    async function resolveConfigId(
      key: "longRunConfigId" | "intervalsConfigId" | "tempoConfigId",
      find: (id: string) => Promise<{ id: string } | null>
    ): Promise<string | null | undefined> {
      if (!(key in body)) return undefined;
      const r = (body as Record<string, unknown>)[key];
      if (r === null || r === "") return null;
      if (typeof r !== "string") {
        throw new Error(`${key} must be a string, null, or empty`);
      }
      const row = await find(r);
      if (!row) {
        throw new Error(`${key} is not a valid config`);
      }
      return r;
    }

    let longRunConfigId: string | null | undefined;
    let intervalsConfigId: string | null | undefined;
    let tempoConfigId: string | null | undefined;
    try {
      longRunConfigId = await resolveConfigId("longRunConfigId", (id) =>
        prisma.long_run_config.findUnique({ where: { id } })
      );
      intervalsConfigId = await resolveConfigId("intervalsConfigId", (id) =>
        prisma.intervals_config.findUnique({ where: { id } })
      );
      tempoConfigId = await resolveConfigId("tempoConfigId", (id) => prisma.tempo_config.findUnique({ where: { id } }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Invalid config id";
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }

    const preset = await prisma.training_plan_preset.create({
      data: {
        slug,
        title: String(title).trim(),
        description:
          typeof description === "string" && description.trim()
            ? description.trim()
            : null,
        ...(longRunConfigId !== undefined
          ? longRunConfigId
            ? { longRunConfig: { connect: { id: longRunConfigId } } }
            : {}
          : {}),
        ...(intervalsConfigId !== undefined
          ? intervalsConfigId
            ? { intervalsConfig: { connect: { id: intervalsConfigId } } }
            : {}
          : {}),
        ...(tempoConfigId !== undefined
          ? tempoConfigId
            ? { tempoConfig: { connect: { id: tempoConfigId } } }
            : {}
          : {}),
        volumeConstraints: {
          create: {
            cycleLen: typeof vol.cycleLen === "number" ? vol.cycleLen : 4,
            minWeeklyMiles: typeof vol.minWeeklyMiles === "number" ? vol.minWeeklyMiles : 40,
            minLongMiles: typeof vol.minLongMiles === "number" ? vol.minLongMiles : 8,
            minEasyPerDayMiles:
              typeof vol.minEasyPerDayMiles === "number" ? vol.minEasyPerDayMiles : 3,
            maxWeeklyMiles: maxWeeklyMiles ?? null,
            baseMiles,
            peakMiles,
            taperMiles,
            buildCoef,
          },
        },
        workoutConfig: {
          create: {
            qualitySessions:
              typeof wkRec.qualitySessions === "number" && Number.isFinite(wkRec.qualitySessions)
                ? Math.min(2, Math.max(0, Math.round(wkRec.qualitySessions)))
                : 1,
            tempoIdealDow: typeof wkRec.tempoIdealDow === "number" ? wkRec.tempoIdealDow : 2,
            intervalIdealDow:
              typeof wkRec.intervalIdealDow === "number" ? wkRec.intervalIdealDow : 4,
            longRunDefaultDow:
              typeof wkRec.longRunDefaultDow === "number" ? wkRec.longRunDefaultDow : 6,
          },
        },
      },
      include: presetInclude,
    });

    return NextResponse.json(
      { success: true, preset: serializePlanPresetForApi(preset) },
      { status: 201 }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/training/plan-preset", e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
