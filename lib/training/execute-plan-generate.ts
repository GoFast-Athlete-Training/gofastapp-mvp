/**
 * Orchestrator: load preset + catalogue rows; assign workout days → long run → tempo → interval → easy;
 * persists structured planSchedule (+ skeleton scalars). No workout rows here.
 */

import { prisma } from "@/lib/prisma";
import { calendarTrainingWeekCount } from "@/lib/training/plan-utils";
import { Prisma } from "@prisma/client";
import { metersToMiles } from "@/lib/pace-utils";
import { goalRacePaceDisplayString } from "@/lib/training/goal-pace-calculator";
import { assignWorkoutDays } from "@/lib/training/assign-workout-days";
import { applyLongRunSchedule } from "@/lib/training/apply-long-run";
import { applyTempoSchedule } from "@/lib/training/apply-tempo";
import { applyIntervalSchedule } from "@/lib/training/apply-interval";
import { distributeEasyMiles } from "@/lib/training/distribute-easy";
import { longRunCupSetter } from "@/lib/training/long-run-cup-setter";
import {
  easyRunConfigToSnapshot,
  parseEasyRunConfigJson,
} from "@/lib/training/easy-run-config";
import {
  catalogueIdsFromPreset,
  catalogueSelectForGeneration,
  mapPositionRow,
  presetToPlanGenConfig,
  trainingPlanPresetInclude,
  type LoadedPresetInclude,
  type CatalogueGenerationRowSelection,
} from "@/lib/training/plan-generate-presets-loader";
import type { CatalogueMileEstimateInput } from "@/lib/training/catalogue-mile-estimate";

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
    preferredTempoDow?: number | null;
    preferredIntervalDow?: number | null;
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

  if (
    rawPreset == null ||
    rawPreset.baseMiles == null ||
    rawPreset.peakMiles == null ||
    rawPreset.taperMiles == null ||
    rawPreset.minWeeklyMiles == null
  ) {
    throw new Error("Preset is incomplete (volume fields missing).");
  }

  const presetLabel =
    (typeof rawPreset.slug === "string" && rawPreset.slug.trim()) ||
    (typeof rawPreset.title === "string" && rawPreset.title.trim()) ||
    planRow.presetId;

  const planConfig = presetToPlanGenConfig(rawPreset);
  const vol = rawPreset;

  const longRunPositions =
    rawPreset.longRunConfig?.positions.map(mapPositionRow) ?? [];
  const intervalsPositions =
    rawPreset.intervalsConfig?.positions.map(mapPositionRow) ?? [];
  const tempoPositions =
    rawPreset.tempoConfig?.positions.map(mapPositionRow) ?? [];

  function qualityRotationInvalid(
    positions: readonly { catalogueWorkoutId: string | null }[]
  ): boolean {
    if (positions.length === 0) return true;
    return !positions.some((p) => p.catalogueWorkoutId?.trim());
  }
  if (qualityRotationInvalid(intervalsPositions)) {
    throw new Error(
      `Training preset "${presetLabel}" has no interval rotation or every slot is missing a catalogue workout. Fix the intervals config in GoFast Company.`
    );
  }
  if (qualityRotationInvalid(tempoPositions)) {
    throw new Error(
      `Training preset "${presetLabel}" has no tempo rotation or every slot is missing a catalogue workout. Fix the tempo config in GoFast Company.`
    );
  }

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

  /** Athlete preference (persisted on the plan). Preset max caps generation only. */
  const requestedWeeklyMileageTarget = Math.max(
    params.minWeeklyMiles,
    Math.min(100, params.weeklyMileageTarget)
  );
  let weeklyMileageTarget = requestedWeeklyMileageTarget;
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
    throw new Error(
      `Training preset "${presetLabel}" has invalid long-run cycle length (${String(vol.cycleLen)}): use 1–8 weeks per long-run rotation block in GoFast Company.`
    );
  }

  const cLen = macroCycleLen();

  const placement = assignWorkoutDays({
    planStartDate: plan.startDate,
    raceDate: race.raceDate,
    raceName: race.name,
    raceDistanceMiles,
    totalWeeks: weekCount,
    preferredDays,
    preferredLongRunDow: plan.preferredLongRunDow,
    preferredTempoDow: plan.preferredTempoDow ?? null,
    preferredIntervalDow: plan.preferredIntervalDow ?? null,
    tempoIdealDow: planConfig.tempoIdealDow ?? 2,
    intervalIdealDow: planConfig.intervalIdealDow ?? 4,
    longRunDefaultDow: planConfig.longRunDefaultDow ?? 6,
    peakWeeklyMilesForCap: weeklyMileageTarget,
    longRunCycleLen: cLen,
    longRunPositions,
    intervalsPositions,
    tempoPositions,
  });

  const schedule = placement.schedule;

  const vb = Number(vol.baseMiles);
  const vp = Number(vol.peakMiles);
  const vt = Number(vol.taperMiles);
  if (!Number.isFinite(vb) || vb <= 0) {
    throw new Error(
      `Training preset "${presetLabel}" has invalid baseMiles. Fix this preset in GoFast Company.`
    );
  }
  if (!Number.isFinite(vp) || vp <= 0) {
    throw new Error(
      `Training preset "${presetLabel}" has invalid peakMiles. Fix this preset in GoFast Company.`
    );
  }
  if (!Number.isFinite(vt) || vt <= 0) {
    throw new Error(
      `Training preset "${presetLabel}" has invalid taperMiles. Fix this preset in GoFast Company.`
    );
  }
  const baseMiles = vb;
  const peakMiles = Math.max(baseMiles, vp);
  const taperMiles = vt;

  applyLongRunSchedule({
    planSchedule: schedule,
    totalWeeks: weekCount,
    cycleLen: cLen,
    baseMiles,
    peakMiles,
    taperMiles,
    longRunPositions,
  });

  const cupResult = longRunCupSetter({
    totalWeeks: weekCount,
    cycleLen: cLen,
    baseMiles,
    peakMiles,
    taperMiles,
  });

  const cyclePoolData = {
    nCycles: cupResult.nCycles,
    cycleLen: cLen,
    poolMilesByCycle: cupResult.poolMilesByCycle,
    baseMiles,
    peakMiles,
    taperMiles,
    positionCounts: {
      longRun: longRunPositions.length,
      intervals: intervalsPositions.length,
      tempo: tempoPositions.length,
    },
  };

  const minWeeklyFromPreset = Number(vol.minWeeklyMiles);
  if (!Number.isFinite(minWeeklyFromPreset) || minWeeklyFromPreset < 1) {
    throw new Error(
      `Training preset "${presetLabel}" has invalid minWeeklyMiles. Fix this preset in GoFast Company.`
    );
  }

  const easyRunResolved = parseEasyRunConfigJson(rawPreset.easyRunConfig);

  applyTempoSchedule({ planSchedule: schedule, catalogueRowsById });
  applyIntervalSchedule({ planSchedule: schedule, catalogueRowsById });
  distributeEasyMiles({
    planSchedule: schedule,
    weeklyMileageTarget,
    minWeeklyMiles: Math.max(minWeeklyFromPreset, params.minWeeklyMiles),
    maxWeeklyMiles:
      vol.maxWeeklyMiles != null && Number.isFinite(Number(vol.maxWeeklyMiles))
        ? Number(vol.maxWeeklyMiles)
        : undefined,
    raceDistanceMiles,
    easyRunConfig: easyRunResolved,
    typicalWeekPreferredCount: preferredDays.length,
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
      peakWeekNumber: placement.peakWeekNumber,
      taperStartWeekNumber: placement.taperStartWeekNumber,
      calculatedLongRunMax: placement.calculatedLongRunMax,
      cyclePoolData: cyclePoolData as unknown as Prisma.InputJsonValue,
      easyRunConfig: easyRunConfigToSnapshot(easyRunResolved) as unknown as Prisma.InputJsonValue,
      weeklyMileageTarget: requestedWeeklyMileageTarget,
      totalWeeks: weekCount,
      ...(syncedFiveKPace != null ? { currentFiveKPace: syncedFiveKPace } : {}),
      ...(mergedGoalTime ? { goalRaceTime: mergedGoalTime } : {}),
      ...(imprintPace ? { goalRacePace: imprintPace } : {}),
      updatedAt: new Date(),
    },
  });

  return { planId: plan.id, weekCount };
}
