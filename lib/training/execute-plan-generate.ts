/**
 * One-shot plan generate: writes `planWeeks` + plan scalars only (no `workouts` rows).
 * Loads `training_plan_preset` boltons + optional `runTypeConfig` when `presetId` is set.
 *
 * Config resolution and catalogue rotation live in `generatePlanFromConfigs`;
 * the pure week builder is `generatePlanWorkoutRows` in `generate-plan.ts`.
 */

import { prisma } from "@/lib/prisma";
import {
  generatePlanFromConfigs,
  type PlanGenConfig,
  runTypeConfigPositionsToInputs,
} from "@/lib/training/generate-plan-from-configs";
import { planWeeksSnapshotFromGeneratedRows } from "@/lib/training/generate-plan";
import { presetBoltonsToPlanGenConfig } from "@/lib/training/preset-to-plan-gen-config";
import { calendarTrainingWeekCount } from "@/lib/training/plan-utils";
import { Prisma } from "@prisma/client";
import { metersToMiles } from "@/lib/pace-utils";
import { goalRacePaceDisplayString } from "@/lib/training/goal-pace-calculator";

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
  const race = planRow.race_registry;

  const [prefs, rawPreset] = await Promise.all([
    prisma.trainingPreferences.findUnique({ where: { athleteId } }),
    plan.presetId
      ? prisma.training_plan_preset.findUnique({
          where: { id: plan.presetId },
          include: {
            volumeConstraints: true,
            workoutConfig: true,
            runTypeConfig: {
              include: {
                positions: { orderBy: { cyclePosition: "asc" } },
              },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  const planConfig: PlanGenConfig | undefined =
    rawPreset?.volumeConstraints && rawPreset?.workoutConfig
      ? presetBoltonsToPlanGenConfig(
          rawPreset.volumeConstraints,
          rawPreset.workoutConfig
        )
      : undefined;

  const runTypeConfigs = rawPreset?.runTypeConfig?.positions?.length
    ? runTypeConfigPositionsToInputs(
        rawPreset.runTypeConfig.positions.map((p) => ({
          cyclePosition: p.cyclePosition,
          catalogueWorkoutId: p.catalogueWorkoutId,
          distributionWeight: p.distributionWeight,
        }))
      )
    : undefined;

  const catalogueIds = [
    ...new Set(
      (rawPreset?.runTypeConfig?.positions ?? [])
        .map((p) => p.catalogueWorkoutId)
        .filter((x): x is string => x != null && x.length > 0)
    ),
  ];
  const catalogueRows =
    catalogueIds.length > 0
      ? await prisma.workout_catalogue.findMany({
          where: { id: { in: catalogueIds } },
          select: { id: true, paceAnchor: true },
        })
      : [];
  const cataloguePaceById = new Map(
    catalogueRows.map((r) => [r.id, { paceAnchor: r.paceAnchor }])
  );

  let weeklyMileageTarget = params.weeklyMileageTarget;
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
  const drafts = generatePlanFromConfigs(
    {
      planId: plan.id,
      athleteId,
      totalWeeks: weekCount,
      planStartDate: plan.startDate,
      raceDate: race.raceDate,
      weeklyMileageTarget,
      minWeeklyMiles: params.minWeeklyMiles,
      preferredDays,
      raceName: race.name,
      raceDistanceMiles,
      preferredLongRunDow: plan.preferredLongRunDow,
      preferredQualityDays: plan.preferredQualityDays,
      planConfig,
      runTypeConfigs,
    },
    cataloguePaceById.size > 0
      ? { cataloguePaceById }
      : {}
  );

  const syncedFiveKPace =
    params.athleteFiveKPace?.trim() ||
    plan.currentFiveKPace?.trim() ||
    null;
  const needsFiveKAnchor = drafts.some(
    (d) =>
      d.workoutType === "Easy" ||
      d.workoutType === "LongRun" ||
      d.workoutType === "Race"
  );
  if (needsFiveKAnchor && !syncedFiveKPace) {
    throw new Error(
      "Set 5K pace on your athlete profile before generating a plan (syncs to the plan for workout zones)."
    );
  }

  const planWeeksSnapshot = planWeeksSnapshotFromGeneratedRows(drafts, weekCount);

  const mergedGoalTime =
    planRow.goalRaceTime?.trim() || planRow.athlete_goal?.goalTime?.trim() || null;
  const imprintPace =
    mergedGoalTime != null
      ? goalRacePaceDisplayString(mergedGoalTime, raceDistanceMiles)
      : null;

  await prisma.training_plans.update({
    where: { id: plan.id },
    data: {
      planWeeks: planWeeksSnapshot as unknown as Prisma.InputJsonValue,
      phases: Prisma.JsonNull,
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
