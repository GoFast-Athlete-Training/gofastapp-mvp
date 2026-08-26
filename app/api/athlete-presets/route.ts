export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { AthletePresetFitnessPhase, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { ageYearsFromBirthday } from "@/lib/training/athlete-preset-volume";
import { presetMatchesDistance } from "@/lib/training/preset-distance-match";
import { inferAthletePresetCore } from "@/lib/training/athlete-preset-core-service";
import { LONG_RUN_BLOCK_WEEKS } from "@/lib/training/long-run-block-weeks";
import { serializeAthletePresetForApi } from "@/lib/training/athlete-preset-blueprint";

function numField(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** GET /api/athlete-presets — athlete-owned presets */
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
      athletePresets: rows.map(serializeAthletePresetForApi),
    });
  } catch (e: unknown) {
    console.error("GET /api/athlete-presets", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load athlete presets" },
      { status: 500 }
    );
  }
}

/** POST /api/athlete-presets — preview infer (no DB) or persist stub after cup confirm */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const previewOnly = body.previewOnly === true;

    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!previewOnly && !title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (previewOnly && !title) {
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
        { error: "sourcePresetId is required — distance template missing" },
        { status: 400 }
      );
    }

    const sourcePreset = await prisma.training_plan_preset.findUnique({
      where: { id: sourcePresetId },
      select: {
        id: true,
        targetDistanceLabel: true,
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
    if (weeklyFromBody == null || !Number.isFinite(Number(weeklyFromBody)) || Number(weeklyFromBody) < 1) {
      return NextResponse.json(
        { error: "weeklyMileage is required — set it on your profile or in the form" },
        { status: 400 }
      );
    }
    const weeklyMileage = Math.round(Number(weeklyFromBody));

    const trainingHistory =
      typeof body.trainingHistory === "string" ? body.trainingHistory.trim() : "";
    if (!trainingHistory) {
      return NextResponse.json(
        { error: "trainingHistory is required — describe your running or tap Add my details" },
        { status: 400 }
      );
    }

    const raceName = typeof body.raceName === "string" ? body.raceName.trim() : "Goal race";
    const raceDate = typeof body.raceDate === "string" ? body.raceDate : "";
    const planStartDate =
      typeof body.planStartDate === "string" ? body.planStartDate : new Date().toISOString();
    if (!raceDate) {
      return NextResponse.json({ error: "raceDate is required" }, { status: 400 });
    }

    const core = await inferAthletePresetCore({
      fitnessPhase,
      trainingHistory,
      ageYears: ageYearsFromBirthday(athleteRow.birthday),
      gender: athleteRow.gender?.trim() || null,
      weeklyMileage,
      fiveKPace: athleteRow.fiveKPace?.trim() || null,
      longRunCapabilityMiles: athleteRow.longRunCapabilityMiles,
      raceName,
      raceDate,
      planStartDate,
      goalTime: typeof body.goalTime === "string" ? body.goalTime.trim() || null : null,
      raceDistanceLabel: sourcePreset.targetDistanceLabel,
    });

    const corePreview = {
      weSeeYou: core.weSeeYou,
      barriers: core.barriers,
      progressionAggressiveness: core.progressionAggressiveness,
      calendar: core.calendar,
      poolMilesByCycle: core.calendar.poolMilesByCycle,
    };

    if (previewOnly) {
      return NextResponse.json({
        corePreview,
        suggestedCups: {
          baseMiles: core.cups.baseMiles,
          peakMiles: core.cups.peakMiles,
          taperMiles: core.cups.taperMiles,
          minWeeklyMiles: core.minWeeklyMiles,
          maxWeeklyMiles: core.maxWeeklyMiles,
        },
      });
    }

    const baseMiles = "baseMiles" in body ? numField(body.baseMiles, core.cups.baseMiles) : core.cups.baseMiles;
    const peakMiles = "peakMiles" in body ? numField(body.peakMiles, core.cups.peakMiles) : core.cups.peakMiles;
    const taperMiles = "taperMiles" in body ? numField(body.taperMiles, core.cups.taperMiles) : core.cups.taperMiles;
    const minWeeklyMiles =
      "minWeeklyMiles" in body ? Math.max(1, Math.round(numField(body.minWeeklyMiles, core.minWeeklyMiles))) : core.minWeeklyMiles;
    const maxWeeklyRaw = body.maxWeeklyMiles;
    const maxWeeklyMiles =
      maxWeeklyRaw == null || maxWeeklyRaw === ""
        ? core.maxWeeklyMiles
        : Math.max(minWeeklyMiles, Math.round(numField(maxWeeklyRaw, core.maxWeeklyMiles ?? minWeeklyMiles)));

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
        baseMiles,
        peakMiles,
        taperMiles,
        minWeeklyMiles,
        maxWeeklyMiles,
        longRunCycleWeeks: LONG_RUN_BLOCK_WEEKS,
        tempoIdealDow: sourcePreset.tempoIdealDow,
        intervalIdealDow: sourcePreset.intervalIdealDow,
        longRunDefaultDow: sourcePreset.longRunDefaultDow,
        trainingHistory,
        fitnessPhase,
        progressionAggressiveness: core.progressionAggressiveness,
        ageYearsSnapshot: ageYearsFromBirthday(athleteRow.birthday),
        genderSnapshot: athleteRow.gender?.trim() || null,
        sourcePresetId,
        coachPlanOverview: { cupsConfirmed: true } as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      athletePreset: serializeAthletePresetForApi(row),
      corePreview,
    });
  } catch (e: unknown) {
    console.error("POST /api/athlete-presets", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create athlete preset" },
      { status: 500 }
    );
  }
}
