export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { serializePlanPresetForApi } from "@/lib/training/quality-percent";

function slugifyPresetTitle(title: string): string {
  const s = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "preset";
}

function numInRange(
  v: unknown,
  def: number,
  opts: { min: number; max: number }
): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.min(opts.max, Math.max(opts.min, v));
  }
  return def;
}

function peakFromVolume(vol: Record<string, unknown>): number {
  const raw = vol.longRunPeakPool ?? vol.cyclePeakPool;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  return 88;
}

export async function GET(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const presets = await prisma.training_plan_preset.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      volumeConstraints: true,
      workoutConfig: true,
      runTypeConfig: { select: { id: true, name: true, description: true, workoutType: true } },
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

    const longRunPeak = peakFromVolume(vol);
    const longRunWeekPct = numInRange(vol.longRunWeekPct, 25, { min: 0, max: 100 });
    const tempoWeekPct = numInRange(vol.tempoWeekPct, 10, { min: 0, max: 100 });
    const intervalsWeekPct = numInRange(vol.intervalsWeekPct, 7, { min: 0, max: 100 });

    let runTypeConfigId: string | null | undefined = undefined;
    if ("runTypeConfigId" in body) {
      const r = (body as Record<string, unknown>).runTypeConfigId;
      if (r === null || r === "") {
        runTypeConfigId = null;
      } else if (typeof r === "string") {
        const cfg = await prisma.run_type_config.findUnique({ where: { id: r } });
        if (!cfg) {
          return NextResponse.json(
            { success: false, error: "runTypeConfigId is not a valid run type config" },
            { status: 400 }
          );
        }
        runTypeConfigId = r;
      } else {
        return NextResponse.json(
          { success: false, error: "runTypeConfigId must be a string, null, or empty" },
          { status: 400 }
        );
      }
    }

    const preset = await prisma.training_plan_preset.create({
      data: {
        slug,
        title: String(title).trim(),
        description:
          typeof description === "string" && description.trim()
            ? description.trim()
            : null,
        ...(runTypeConfigId !== undefined ? { runTypeConfigId } : {}),
        volumeConstraints: {
          create: {
            cycleLen: typeof vol.cycleLen === "number" ? vol.cycleLen : 4,
            minWeeklyMiles: typeof vol.minWeeklyMiles === "number" ? vol.minWeeklyMiles : 40,
            minLongMiles: typeof vol.minLongMiles === "number" ? vol.minLongMiles : 8,
            minEasyPerDayMiles:
              typeof vol.minEasyPerDayMiles === "number" ? vol.minEasyPerDayMiles : 3,
            longRunWeekPct,
            tempoWeekPct,
            intervalsWeekPct,
            longRunPeakPool: longRunPeak,
            cyclePoolBuildCoef:
              typeof vol.cyclePoolBuildCoef === "number" && Number.isFinite(vol.cyclePoolBuildCoef)
                ? vol.cyclePoolBuildCoef
                : 1.12,
            cyclePoolTaperCoef:
              typeof vol.cyclePoolTaperCoef === "number" && Number.isFinite(vol.cyclePoolTaperCoef)
                ? vol.cyclePoolTaperCoef
                : 0.85,
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
