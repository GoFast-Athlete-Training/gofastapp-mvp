export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { normalizeTaperLongRuns } from "@/lib/training/preset-volume-helpers";
import {
  parseBoltonQualityToFraction,
  serializePlanPresetForApi,
} from "@/lib/training/quality-percent";

function slugifyPresetTitle(title: string): string {
  const s = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "preset";
}

export async function GET(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const presets = await prisma.training_plan_preset.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      volumeConstraints: true,
      workoutConfig: true,
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

    const vol = volume && typeof volume === "object" ? volume : {};
    const wk = workout && typeof workout === "object" ? workout : {};
    const wkRec = wk as Record<string, unknown>;
    const qualityFraction = parseBoltonQualityToFraction(wkRec) ?? 0.22;

    const taperWeeks = typeof vol.taperWeeks === "number" ? vol.taperWeeks : 3;
    const taperLongRuns = normalizeTaperLongRuns(taperWeeks, vol.taperLongRuns);

    const preset = await prisma.training_plan_preset.create({
      data: {
        slug,
        title: String(title).trim(),
        description:
          typeof description === "string" && description.trim()
            ? description.trim()
            : null,
        volumeConstraints: {
          create: {
            taperWeeks,
            peakWeeks: typeof vol.peakWeeks === "number" ? vol.peakWeeks : 4,
            taperLongRuns,
            baseStartMiles:
              typeof vol.baseStartMiles === "number" ? vol.baseStartMiles : 8,
            ladderStep: typeof vol.ladderStep === "number" ? vol.ladderStep : 2,
            ladderCycleLen:
              typeof vol.ladderCycleLen === "number" ? vol.ladderCycleLen : 4,
            peakEntryMiles:
              typeof vol.peakEntryMiles === "number" ? vol.peakEntryMiles : 18,
            peakLongRunMiles:
              typeof vol.peakLongRunMiles === "number" ? vol.peakLongRunMiles : 22,
            cutbackWeekModulo:
              typeof vol.cutbackWeekModulo === "number" ? vol.cutbackWeekModulo : 3,
            weeklyMileageMultiplier:
              typeof vol.weeklyMileageMultiplier === "number"
                ? vol.weeklyMileageMultiplier
                : 2.5,
            taperMileageReduction:
              typeof vol.taperMileageReduction === "number"
                ? vol.taperMileageReduction
                : 0.75,
            longRunCapFraction:
              typeof vol.longRunCapFraction === "number" ? vol.longRunCapFraction : 0.4,
            minWeeklyMiles: typeof vol.minWeeklyMiles === "number" ? vol.minWeeklyMiles : 40,
            minLongMiles: typeof vol.minLongMiles === "number" ? vol.minLongMiles : 8,
            minEasyPerDayMiles:
              typeof vol.minEasyPerDayMiles === "number" ? vol.minEasyPerDayMiles : 3,
            minEasyWeekMiles:
              typeof vol.minEasyWeekMiles === "number" ? vol.minEasyWeekMiles : 4,
          },
        },
        workoutConfig: {
          create: {
            qualityFraction,
            qualitySessions:
              typeof wk.qualitySessions === "number" && Number.isFinite(wk.qualitySessions)
                ? Math.min(2, Math.max(0, Math.round(wk.qualitySessions)))
                : 1,
            qualityOnLongRun: wk.qualityOnLongRun === true,
            tempoIdealDow: typeof wk.tempoIdealDow === "number" ? wk.tempoIdealDow : 2,
            intervalIdealDow:
              typeof wk.intervalIdealDow === "number" ? wk.intervalIdealDow : 4,
            longRunDefaultDow:
              typeof wk.longRunDefaultDow === "number" ? wk.longRunDefaultDow : 6,
          },
        },
      },
      include: {
        volumeConstraints: true,
        workoutConfig: true,
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
