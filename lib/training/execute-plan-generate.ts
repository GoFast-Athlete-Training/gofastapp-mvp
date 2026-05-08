/**
 * Orchestrator: load preset + catalogue rows; stub skeleton → LR → quality/easy;
 * persists structured planSchedule (+ skeleton scalars). No workouts rows here.
 */

import { prisma } from "@/lib/prisma";
import { calendarTrainingWeekCount } from "@/lib/training/plan-utils";
import { Prisma } from "@prisma/client";
import { metersToMiles } from "@/lib/pace-utils";
import { goalRacePaceDisplayString } from "@/lib/training/goal-pace-calculator";
import { buildPlanScheduleStub } from "@/lib/training/plan-schedule-stub";
import { applyLongRunSchedule } from "@/lib/training/apply-long-run";
import { applyQualityAndEasySchedule } from "@/lib/training/apply-quality-easy";
import {
  catalogueIdsFromPreset,
  catalogueSelectForGeneration,
  mapPositionRow,
  presetBoltonsToPlanGenConfig,
  trainingPlanPresetInclude,
  type LoadedPresetInclude,
  type CatalogueGenerationRowSelection,
  type PlanGenPresetBoltonsInput,
} from "@/lib/training/plan-generate-presets-loader";
import type { CatalogueMileEstimateInput } from "@/lib/training/apply-quality-easy";

export async function executePlanGenerate(params: {
  athleteId: string;
  athleteFiveKPace: string | null;
  athleteWeeklyMileage: number | null;
  plan: {
    id: string;
    presetId?: string | null;
    startDate: Date;
    preferredDays: number[];
    preferredLongRunDow: number | null;
    preferredQualityDays?: number[];
    currentFiveKPace: string | null;
    weeklyMileageTarget: number | null;
  };
  weeklyMileageTarget: number;
  minWeeklyMiles: number;
}): Promise<{ planId: string; weekCount: number }> {
  const { athleteId, plan } = params;

  const planRow = await prisma.training_plans.findFirst({
    where: { id: plan.id, athleteId },
    include: {
      race_registry: true,
      athlete_goal: { select: { goalTime: true } },
    },
  });
  if (!planRow?.race_registry) {
    throw new Error("Plan not found or has no linked race");
  }
  if (!planRow.presetId) {
    throw new Error(
      "This plan has no training preset linked — re-create your plan or contact support."
    );
  }

  const race = planRow.race_registry;

  const [prefs, rawPreset] = await Promise.all([
    prisma.trainingPreferences.findUnique({ where: { athleteId } }),
    prisma.training_plan_preset.findUnique({
      where: { id: planRow.presetId },
      include: trainingPlanPresetInclude,
    }),
  ]);

  if (!rawPreset?.volumeConstraints || !rawPreset.workoutConfig) {
    throw new Error("Preset is incomplete (volume/workout boltons missing).");
  }

  const boltonsInput: PlanGenPresetBoltonsInput = {
    volumeConstraints: rawPreset.volumeConstraints,
    workoutConfig: rawPreset.workoutConfig,
  };
  const planConfig = presetBoltonsToPlanGenConfig(boltonsInput);
  const vol = boltonsInput.volumeConstraints;

  const longRunPositions =
    rawPreset.longRunConfig?.positions.map(mapPositionRow) ?? [];
  const intervalsPositions =
    rawPreset.intervalsConfig?.positions.map(mapPositionRow) ?? [];
  const tempoPositions =
    rawPreset.tempoConfig?.positions.map(mapPositionRow) ?? [];

  const catalogueIds = catalogueIdsFromPreset(rawPreset as LoadedPresetInclude);
  const catalogueRowsFull: CatalogueGenerationRowSelection[] =
    catalogueIds.length > 0
      ? await prisma.workout_catalogue.findMany({
          where: { id: { in: catalogueIds } },
          select: catalogueSelectForGeneration,
        })
      : [];

  const catalogueRowsById = new Map<string, CatalogueMileEstimateInput>(
    catalogueRowsFull.map((r) => [r.id, r])
  );

  let weeklyMileageTarget = params.weeklyMileageTarget;
  const cap = planConfig.maxWeeklyMiles;
  if (cap != null && Number.isFinite(cap) && cap > 0) {
    weeklyMileageTarget = Math.min(weeklyMileageTarget, cap);
  }
  weeklyMileageTarget = Math.max(
    params.minWeeklyMiles,
    Math.min(100, weeklyMileageTarget)
  );

  const preferredDays =
    plan.preferredDays?.length > 0
      ? plan.preferredDays
      : prefs?.preferredDays?.length
        ? prefs.preferredDays
        : [1, 2, 3, 4, 5, 6];

  const weekCount = calendarTrainingWeekCount(plan.startDate, race.raceDate);
  const raceDistanceMiles =
    race.distanceMeters != null && Number.isFinite(Number(race.distanceMeters))
      ? metersToMiles(Number(race.distanceMeters))
      : 3.1;

  function macroCycleLen(): number {
    const cv = vol.cycleLen;
    const c =
      typeof cv === "number" && Number.isFinite(cv) ? Math.round(cv) : NaN;
    if (c >= 1 && c <= 8) return c;
    const pc = planConfig.cycleLen;
    if (
      typeof pc === "number" &&
      Number.isFinite(pc) &&
      Math.floor(pc) >= 1 &&
      Math.floor(pc) <= 8
    ) {
      return Math.floor(pc);
    }
    return 4;
  }

  const cLen = macroCycleLen();

  const skeleton = buildPlanScheduleStub({
    planStartDate: plan.startDate,
    raceDate: race.raceDate,
    raceName: race.name,
    raceDistanceMiles,
    totalWeeks: weekCount,
    preferredDays,
    preferredLongRunDow: plan.preferredLongRunDow,
    preferredQualityDays: plan.preferredQualityDays,
    tempoIdealDow: planConfig.tempoIdealDow ?? 2,
    intervalIdealDow: planConfig.intervalIdealDow ?? 4,
    longRunDefaultDow: planConfig.longRunDefaultDow ?? 6,
    peakWeeklyMilesForCap: planConfig.peakMiles ?? null,
    longRunPositions,
    intervalsPositions,
    tempoPositions,
  });

  const schedule = skeleton.schedule;

  const inferredBaseFallback = weeklyMileageTarget * cLen * 0.92;
  const baseMiles =
    vol.baseMiles != null && Number.isFinite(Number(vol.baseMiles))
      ? Math.max(1, Number(vol.baseMiles))
      : Math.round(inferredBaseFallback * 10) / 10;
  let peakMiles =
    vol.peakMiles != null && Number.isFinite(Number(vol.peakMiles))
      ? Math.max(baseMiles, Number(vol.peakMiles))
      : Math.max(baseMiles, weeklyMileageTarget * cLen);
  peakMiles = Math.round(Math.max(baseMiles, peakMiles) * 10) / 10;
  const taperMiles =
    vol.taperMiles != null && Number.isFinite(Number(vol.taperMiles))
      ? Math.max(1, Number(vol.taperMiles))
      : Math.round(Math.max(baseMiles, peakMiles * 0.85) * 10) / 10;

  applyLongRunSchedule({
    planSchedule: schedule,
    totalWeeks: weekCount,
    cycleLen: cLen,
    baseMiles,
    peakMiles,
    taperMiles,
    longRunPositions,
    calculatedLongRunMax: skeleton.calculatedLongRunMax,
    minLongMi: 8,
  });

  const minPresetWeekly =
    vol.minWeeklyMiles != null && Number.isFinite(Number(vol.minWeeklyMiles))
      ? Number(vol.minWeeklyMiles)
      : params.minWeeklyMiles;

  applyQualityAndEasySchedule({
    planSchedule: schedule,
    totalWeeks: weekCount,
    weeklyMileageTarget,
    minWeeklyMiles: Math.max(minPresetWeekly, params.minWeeklyMiles),
    cycleLen: cLen,
    baseMiles,
    peakMiles,
    taperMiles,
    maxWeeklyMiles:
      vol.maxWeeklyMiles != null && Number.isFinite(Number(vol.maxWeeklyMiles))
        ? Number(vol.maxWeeklyMiles)
        : undefined,
    raceDistanceMiles,
    catalogueRowsById,
    minEasyPerDayMiles: 3,
    minTempoMiles: planConfig.minTempoMiles ?? 3,
    minIntervalMiles: planConfig.minIntervalMiles ?? 3,
  });

  const syncedFiveKPace =
    params.athleteFiveKPace?.trim() ||
    plan.currentFiveKPace?.trim() ||
    null;

  const needsFiveKAnchor = schedule.some((w) =>
    w.days.some(
      (d) =>
        d.workoutType === "Easy" ||
        d.workoutType === "LongRun" ||
        d.workoutType === "Race"
    )
  );
  if (needsFiveKAnchor && !syncedFiveKPace) {
    throw new Error(
      "Set 5K pace on your athlete profile before generating a plan (syncs to the plan for workout zones)."
    );
  }

  const mergedGoalTime =
    planRow.goalRaceTime?.trim() ||
    planRow.athlete_goal?.goalTime?.trim() ||
    null;
  const imprintPace =
    mergedGoalTime != null
      ? goalRacePaceDisplayString(mergedGoalTime, raceDistanceMiles)
      : null;

  await prisma.training_plans.update({
    where: { id: plan.id },
    data: {
      planSchedule: schedule as unknown as Prisma.InputJsonValue,
      phases: Prisma.JsonNull,
      peakWeekNumber: skeleton.peakWeekNumber,
      taperStartWeekNumber: skeleton.taperStartWeekNumber,
      calculatedLongRunMax: skeleton.calculatedLongRunMax,
      weeklyMileageTarget,
      totalWeeks: weekCount,
      ...(syncedFiveKPace != null ? { currentFiveKPace: syncedFiveKPace } : {}),
      ...(mergedGoalTime ? { goalRaceTime: mergedGoalTime } : {}),
      ...(imprintPace ? { goalRacePace: imprintPace } : {}),
      updatedAt: new Date(),
    },
  });

  return { planId: plan.id, weekCount };
}
