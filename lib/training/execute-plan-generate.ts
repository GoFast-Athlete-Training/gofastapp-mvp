/**
 * One-shot plan generate: writes `planWeeks` + plan scalars only (no `workouts` rows).
 * Loads training_plan_preset boltons when presetId is set; falls back to hardcoded defaults.
 */

import { prisma } from "@/lib/prisma";
import {
  assignRotationalIdentifiers,
  generatePlanWorkoutRows,
  planWeeksSnapshotFromGeneratedRows,
  type PlanGenConfig,
} from "@/lib/training/generate-plan";
import { presetBoltonsToPlanGenConfig } from "@/lib/training/preset-to-plan-gen-config";
import { calendarTrainingWeekCount } from "@/lib/training/plan-utils";
import { Prisma } from "@prisma/client";
import { metersToMiles } from "@/lib/pace-utils";

type RaceForGenerate = {
  raceDate: Date;
  name: string;
  distanceMeters: number | null;
};

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
    currentFiveKPace: string | null;
    weeklyMileageTarget: number | null;
    race_registry: RaceForGenerate;
  };
  weeklyMileageTarget: number;
  minWeeklyMiles: number;
}): Promise<{ planId: string; weekCount: number }> {
  const { athleteId, plan } = params;
  const [prefs, rawPreset] = await Promise.all([
    prisma.trainingPreferences.findUnique({ where: { athleteId } }),
    plan.presetId
      ? prisma.training_plan_preset.findUnique({
          where: { id: plan.presetId },
          include: {
            volumeConstraints: true,
            workoutConfig: true,
          },
        })
      : Promise.resolve(null),
  ]);

  const config: PlanGenConfig | undefined =
    rawPreset?.volumeConstraints && rawPreset?.workoutConfig
      ? presetBoltonsToPlanGenConfig(
          rawPreset.volumeConstraints,
          rawPreset.workoutConfig
        )
      : undefined;

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

  const race = plan.race_registry;
  const weekCount = calendarTrainingWeekCount(plan.startDate, race.raceDate);
  const raceDistanceMiles =
    race.distanceMeters != null && Number.isFinite(Number(race.distanceMeters))
      ? metersToMiles(Number(race.distanceMeters))
      : 3.1;
  const drafts = generatePlanWorkoutRows({
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
    config,
  });
  assignRotationalIdentifiers(drafts);

  const syncedFiveKPace =
    params.athleteFiveKPace?.trim() ||
    plan.currentFiveKPace?.trim() ||
    null;
  const needsFiveKAnchor = drafts.some(
    (d) => d.workoutType === "Easy" || d.workoutType === "LongRun"
  );
  if (needsFiveKAnchor && !syncedFiveKPace) {
    throw new Error(
      "Set 5K pace on your athlete profile before generating a plan (syncs to the plan for workout zones)."
    );
  }

  const planWeeksSnapshot = planWeeksSnapshotFromGeneratedRows(drafts, weekCount);

  await prisma.training_plans.update({
    where: { id: plan.id },
    data: {
      planWeeks: planWeeksSnapshot as unknown as Prisma.InputJsonValue,
      phases: Prisma.JsonNull,
      weeklyMileageTarget,
      totalWeeks: weekCount,
      ...(syncedFiveKPace != null ? { currentFiveKPace: syncedFiveKPace } : {}),
      updatedAt: new Date(),
    },
  });

  return { planId: plan.id, weekCount };
}
