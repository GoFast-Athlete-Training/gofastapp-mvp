export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertTrainingEngineAuth } from "@/lib/training/training-engine-auth";

const DEFAULT_ANCHORS = {
  "0": 0,
  "-1": 9,
  "-2": 13,
  "-3": 15,
  "-4": 21,
  "-5": 21,
};

export async function GET(request: NextRequest) {
  const authErr = assertTrainingEngineAuth(request);
  if (authErr) return authErr;

  const presets = await prisma.training_plan_preset.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      volumeConstraints: true,
      workoutConfig: true,
    },
  });
  return NextResponse.json({ success: true, presets });
}

export async function POST(request: NextRequest) {
  const authErr = assertTrainingEngineAuth(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const { slug, title, description, volume, workout } = body;

    if (!slug || !title) {
      return NextResponse.json(
        { success: false, error: "slug and title are required" },
        { status: 400 }
      );
    }

    const existing = await prisma.training_plan_preset.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "A preset with this slug already exists" },
        { status: 409 }
      );
    }

    const vol = volume && typeof volume === "object" ? volume : {};
    const wk = workout && typeof workout === "object" ? workout : {};

    const taperAnchors =
      vol.taperLongRunAnchors && typeof vol.taperLongRunAnchors === "object"
        ? vol.taperLongRunAnchors
        : DEFAULT_ANCHORS;

    const preset = await prisma.training_plan_preset.create({
      data: {
        slug: String(slug).trim().toLowerCase(),
        title: String(title).trim(),
        description:
          typeof description === "string" && description.trim()
            ? description.trim()
            : null,
        volumeConstraints: {
          create: {
            taperWeeks: typeof vol.taperWeeks === "number" ? vol.taperWeeks : 3,
            peakWeeks: typeof vol.peakWeeks === "number" ? vol.peakWeeks : 4,
            taperLongRunAnchors: taperAnchors,
            peakLongRunMiles: typeof vol.peakLongRunMiles === "number" ? vol.peakLongRunMiles : 22,
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
            tempoStartMiles:
              typeof wk.tempoStartMiles === "number" ? wk.tempoStartMiles : 5,
            intervalStartMiles:
              typeof wk.intervalStartMiles === "number" ? wk.intervalStartMiles : 5,
            minTempoMiles: typeof wk.minTempoMiles === "number" ? wk.minTempoMiles : 3,
            minIntervalMiles:
              typeof wk.minIntervalMiles === "number" ? wk.minIntervalMiles : 3,
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

    return NextResponse.json({ success: true, preset }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/training/plan-preset", e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
