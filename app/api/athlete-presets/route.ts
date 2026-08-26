export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { AthletePresetFitnessPhase } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { ageYearsFromBirthday, resolveWeeklyMileageForPresetInfer } from "@/lib/training/athlete-preset-volume";
import { presetMatchesDistance } from "@/lib/training/preset-distance-match";
import { inferAthletePresetCore } from "@/lib/training/athlete-preset-core-service";
import {
  coachOverviewFromCoreInfer,
  mergeCoachPlanOverview,
} from "@/lib/training/athlete-preset-coach-overview";
import { computeCoreVolumeCalendarPreview } from "@/lib/training/core-volume-compute";
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

    const trainingHistory =
      typeof body.trainingHistory === "string" ? body.trainingHistory.trim() : "";
    if (!trainingHistory) {
      return NextResponse.json(
        { error: "trainingHistory is required — describe your running or tap Add my details" },
        { status: 400 }
      );
    }

    const longRunFromBody =
      body.longRunCapabilityMiles != null && body.longRunCapabilityMiles !== ""
        ? Number(body.longRunCapabilityMiles)
        : null;
    const longRunCapabilityMiles =
      longRunFromBody != null && Number.isFinite(longRunFromBody) && longRunFromBody > 0
        ? Math.round(longRunFromBody * 10) / 10
        : athleteRow.longRunCapabilityMiles;

    const weeklyFromBody =
      body.weeklyMileage != null && body.weeklyMileage !== ""
        ? Number(body.weeklyMileage)
        : null;
    const weeklyMileage = resolveWeeklyMileageForPresetInfer({
      fitnessPhase,
      trainingHistory,
      profileWeeklyMileage: athleteRow.weeklyMileage,
      longRunCapabilityMiles,
      bodyWeeklyMileage:
        weeklyFromBody != null && Number.isFinite(weeklyFromBody) ? weeklyFromBody : null,
    });

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
      longRunCapabilityMiles,
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
      longestSaturdayMiles: core.longestSaturdayMiles,
      calendar: core.calendar,
      poolMilesByCycle: core.calendar.poolMilesByCycle,
      peakPoolKey: core.calendar.peakPoolKey,
      peakLongRunDate: core.calendar.peakLongRunDate,
      taperStartDate: core.calendar.taperStartDate,
    };

    if (previewOnly) {
      return NextResponse.json({
        corePreview,
        suggestedCups: {
          baseLongRunPoolMiles: core.cups.baseLongRunPoolMiles,
          peakLongRunPoolMiles: core.cups.peakLongRunPoolMiles,
          taperLongRunPoolMiles: core.cups.taperLongRunPoolMiles,
          minWeeklyMiles: core.minWeeklyMiles,
          maxWeeklyMiles: core.maxWeeklyMiles,
          longestSaturdayMiles: core.longestSaturdayMiles,
        },
      });
    }

    const baseLongRunPoolMiles = "baseLongRunPoolMiles" in body ? numField(body.baseLongRunPoolMiles, core.cups.baseLongRunPoolMiles) : core.cups.baseLongRunPoolMiles;
    const peakLongRunPoolMiles = "peakLongRunPoolMiles" in body ? numField(body.peakLongRunPoolMiles, core.cups.peakLongRunPoolMiles) : core.cups.peakLongRunPoolMiles;
    const taperLongRunPoolMiles = "taperLongRunPoolMiles" in body ? numField(body.taperLongRunPoolMiles, core.cups.taperLongRunPoolMiles) : core.cups.taperLongRunPoolMiles;
    const minWeeklyMiles =
      "minWeeklyMiles" in body ? Math.max(1, Math.round(numField(body.minWeeklyMiles, core.minWeeklyMiles))) : core.minWeeklyMiles;
    const maxWeeklyRaw = body.maxWeeklyMiles;
    const maxWeeklyMiles =
      maxWeeklyRaw == null || maxWeeklyRaw === ""
        ? core.maxWeeklyMiles
        : Math.max(minWeeklyMiles, Math.round(numField(maxWeeklyRaw, core.maxWeeklyMiles ?? minWeeklyMiles)));

    const planStart = new Date(planStartDate);
    const raceDt = new Date(raceDate);
    const calendar = computeCoreVolumeCalendarPreview({
      planStartDate: planStart,
      raceDate: raceDt,
      baseLongRunPoolMiles,
      peakLongRunPoolMiles,
      taperLongRunPoolMiles,
    });
    const longestSaturdayMiles =
      "longestSaturdayMiles" in body
        ? numField(body.longestSaturdayMiles, core.longestSaturdayMiles)
        : core.longestSaturdayMiles;

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
        baseLongRunPoolMiles,
        peakLongRunPoolMiles,
        taperLongRunPoolMiles,
        minWeeklyMiles,
        maxWeeklyMiles,
        longestSaturdayMiles,
        trainingStartDate: planStart,
        raceDateSnapshot: raceDt,
        peakLongRunDate: calendar.peakLongRunDate
          ? new Date(`${calendar.peakLongRunDate}T12:00:00.000Z`)
          : null,
        taperStartDate: calendar.taperStartDate
          ? new Date(`${calendar.taperStartDate}T12:00:00.000Z`)
          : null,
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
        coachPlanOverview: mergeCoachPlanOverview(
          null,
          coachOverviewFromCoreInfer({
            weSeeYou: core.weSeeYou,
            barriers: core.barriers,
            progressionAggressiveness: core.progressionAggressiveness,
            calendar,
            cupsConfirmed: true,
          })
        ),
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
