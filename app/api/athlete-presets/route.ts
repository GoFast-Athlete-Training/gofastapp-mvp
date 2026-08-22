export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { AthletePresetFitnessPhase } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  ageYearsFromBirthday,
  buildTrainingHistoryPrefill,
  computeAthletePresetVolume,
} from "@/lib/training/athlete-preset-volume";
import { presetMatchesDistance } from "@/lib/training/preset-distance-match";

function serializeAthletePreset(row: {
  id: string;
  title: string;
  description: string | null;
  objectiveOfPlan: string | null;
  fitnessPhase: AthletePresetFitnessPhase;
  trainingHistory: string | null;
  sourcePresetId: string | null;
  minWeeklyMiles: number;
  baseMiles: number;
  peakMiles: number;
  taperMiles: number;
  createdAt: Date;
}) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    objectiveOfPlan: row.objectiveOfPlan,
    fitnessPhase: row.fitnessPhase,
    trainingHistory: row.trainingHistory,
    sourcePresetId: row.sourcePresetId,
    minWeeklyMiles: row.minWeeklyMiles,
    baseMiles: row.baseMiles,
    peakMiles: row.peakMiles,
    taperMiles: row.taperMiles,
    createdAt: row.createdAt.toISOString(),
  };
}

/** GET /api/athlete-presets — athlete-owned blueprints */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const rows = await prisma.athlete_presets.findMany({
      where: { athleteId: auth.athlete.id },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      athletePresets: rows.map(serializeAthletePreset),
    });
  } catch (e: unknown) {
    console.error("GET /api/athlete-presets", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load athlete presets" },
      { status: 500 }
    );
  }
}

/** POST /api/athlete-presets — create athlete-owned blueprint (never writes catalog) */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const fitnessPhaseRaw = body.fitnessPhase;
    const fitnessPhase: AthletePresetFitnessPhase =
      fitnessPhaseRaw === "PEAK" ? "PEAK" : "BASE";

    const sourcePresetId =
      typeof body.sourcePresetId === "string" && body.sourcePresetId.trim()
        ? body.sourcePresetId.trim()
        : null;
    if (!sourcePresetId) {
      return NextResponse.json(
        { error: "sourcePresetId is required — pick a GoFast workout template" },
        { status: 400 }
      );
    }

    const sourcePreset = await prisma.training_plan_preset.findUnique({
      where: { id: sourcePresetId },
      select: {
        id: true,
        targetDistanceLabel: true,
        cycleLen: true,
        tempoIdealDow: true,
        intervalIdealDow: true,
        longRunDefaultDow: true,
      },
    });
    if (!sourcePreset) {
      return NextResponse.json({ error: "sourcePresetId not found" }, { status: 404 });
    }

    const targetDistanceMeters =
      typeof body.targetDistanceMeters === "number" ? body.targetDistanceMeters : null;
    if (
      targetDistanceMeters != null &&
      !presetMatchesDistance(sourcePreset.targetDistanceLabel, targetDistanceMeters)
    ) {
      return NextResponse.json(
        { error: "Workout template does not match this race distance" },
        { status: 422 }
      );
    }

    const athleteRow = await prisma.athlete.findUnique({
      where: { id: auth.athlete.id },
      select: {
        birthday: true,
        gender: true,
        weeklyMileage: true,
        fiveKPace: true,
        longRunCapabilityMiles: true,
      },
    });
    if (!athleteRow) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const weeklyFromBody =
      body.weeklyMileage != null && body.weeklyMileage !== ""
        ? Number(body.weeklyMileage)
        : athleteRow.weeklyMileage;
    const volume = computeAthletePresetVolume({
      fitnessPhase,
      weeklyMileage: weeklyFromBody,
    });

    const trainingHistory =
      typeof body.trainingHistory === "string" && body.trainingHistory.trim()
        ? body.trainingHistory.trim()
        : buildTrainingHistoryPrefill(athleteRow);

    const row = await prisma.athlete_presets.create({
      data: {
        athleteId: auth.athlete.id,
        title,
        description:
          typeof body.description === "string" ? body.description.trim() || null : null,
        objectiveOfPlan:
          typeof body.objectiveOfPlan === "string"
            ? body.objectiveOfPlan.trim() || null
            : fitnessPhase === "PEAK"
              ? "Sharpen toward race — already built up"
              : "Build base toward race",
        ...volume,
        cycleLen: sourcePreset.cycleLen,
        tempoIdealDow: sourcePreset.tempoIdealDow,
        intervalIdealDow: sourcePreset.intervalIdealDow,
        longRunDefaultDow: sourcePreset.longRunDefaultDow,
        trainingHistory,
        fitnessPhase,
        ageYearsSnapshot: ageYearsFromBirthday(athleteRow.birthday),
        genderSnapshot: athleteRow.gender?.trim() || null,
        sourcePresetId,
      },
    });

    return NextResponse.json({ athletePreset: serializeAthletePreset(row) });
  } catch (e: unknown) {
    console.error("POST /api/athlete-presets", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create athlete preset" },
      { status: 500 }
    );
  }
}
