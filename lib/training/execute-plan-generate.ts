/**
 * One-shot plan generate: writes `planWeeks` + plan scalars only (no `workouts` rows).
 */

import { prisma } from "@/lib/prisma";
import {
  assignRotationalIdentifiers,
  generatePlanWorkoutRows,
  planWeeksSnapshotFromGeneratedRows,
} from "@/lib/training/generate-plan";
import { calendarTrainingWeekCount } from "@/lib/training/plan-utils";
import { Prisma } from "@prisma/client";

type RaceForGenerate = {
  raceDate: Date;
  name: string;
  distanceMiles: number;
};

export async function executePlanGenerate(params: {
  athleteId: string;
  athleteFiveKPace: string | null;
  athleteWeeklyMileage: number | null;
  plan: {
    id: string;
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
  const prefs = await prisma.trainingPreferences.findUnique({
    where: { athleteId },
  });

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
    raceDistanceMiles: race.distanceMiles,
    preferredLongRunDow: plan.preferredLongRunDow,
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
