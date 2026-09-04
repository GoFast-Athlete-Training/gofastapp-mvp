/**
 * Trace canonical training plan / goal / Garmin state for one athlete.
 * Run: npx tsx scripts/diagnose-athlete-training-state.ts <athleteId>
 */

import { TrainingPlanLifecycle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { listAthleteRaceGoals } from "@/lib/athlete-race-goal";
import { loadTrainingHydrateSnapshot } from "@/lib/training/training-hydrate-service";
import { findActiveTrainingPlanForAthlete } from "@/lib/athlete-primary-race";
import { utcDateOnly } from "@/lib/training/plan-utils";

export type AthleteTrainingStateDiagnosis = {
  athleteId: string;
  garminConnected: boolean;
  activePlan: {
    id: string;
    athleteRaceId: string | null;
    lifecycleStatus: string;
    startDate: string;
    totalWeeks: number;
    goalRaceTime: string | null;
    goalRacePace: string | null;
    planScheduleWeeks: number;
    currentWeek: number | null;
  } | null;
  otherPlans: Array<{
    id: string;
    lifecycleStatus: string;
    athleteRaceId: string | null;
    startDate: string;
    totalWeeks: number;
    planScheduleWeeks: number;
  }>;
  athleteRaces: Array<{
    id: string;
    name: string;
    raceDate: string;
    goalTime: string | null;
    isPrimaryRace: boolean;
  }>;
  goalsApiFirst: {
    id: string;
    goalTime: string | null;
    name: string | null;
  } | null;
  hydrate: {
    hasActivePlan: boolean;
    planId: string | null;
    goalFinishTime: string | null;
    goalPace: string | null;
  };
  activePlansApiCount: number;
  plannedWorkouts: {
    byPlanId: Record<
      string,
      { count: number; withWorkoutPushed: number }
    >;
  };
  legacyWorkouts: {
    byPlanId: Record<
      string,
      { count: number; withWorkoutPushed: number }
    >;
  };
};

function planScheduleWeekCount(planSchedule: unknown): number {
  return Array.isArray(planSchedule) ? planSchedule.length : 0;
}

export async function diagnoseAthleteTrainingState(
  athleteId: string
): Promise<AthleteTrainingStateDiagnosis> {
  const todayUtc = utcDateOnly(new Date());

  const [athlete, allPlans, athleteRaces, goals, hydrate, activePlanRef, plannedRows, workoutRows] =
    await Promise.all([
      prisma.athlete.findUnique({
        where: { id: athleteId },
        select: {
          garmin_access_token: true,
          garmin_user_id: true,
        },
      }),
      prisma.training_plans.findMany({
        where: { athleteId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          lifecycleStatus: true,
          athleteRaceId: true,
          startDate: true,
          totalWeeks: true,
          goalRaceTime: true,
          goalRacePace: true,
          planSchedule: true,
          updatedAt: true,
        },
      }),
      prisma.athlete_races.findMany({
        where: { athleteId },
        orderBy: { raceDate: "asc" },
        select: {
          id: true,
          name: true,
          raceDate: true,
          goalTime: true,
          isPrimaryRace: true,
        },
      }),
      listAthleteRaceGoals(athleteId),
      loadTrainingHydrateSnapshot(athleteId),
      findActiveTrainingPlanForAthlete(athleteId),
      prisma.planned_workouts.findMany({
        where: { athleteId, date: { gte: todayUtc } },
        select: {
          planId: true,
          workoutPushed: true,
        },
      }),
      prisma.workouts.findMany({
        where: { athleteId, date: { gte: todayUtc } },
        select: {
          planId: true,
        },
      }),
    ]);

  const activePlanRow = allPlans.find((p) => p.lifecycleStatus === TrainingPlanLifecycle.ACTIVE) ?? null;
  const activePlansApiCount = allPlans.filter(
    (p) => p.lifecycleStatus === TrainingPlanLifecycle.ACTIVE
  ).length;

  const firstGoal = goals[0] ?? null;

  function bucketByPlanId(
    rows: Array<{
      planId: string | null;
      workoutPushed?: boolean;
    }>
  ) {
    const out: Record<
      string,
      { count: number; withWorkoutPushed: number }
    > = {};
    for (const row of rows) {
      const key = row.planId ?? "(none)";
      if (!out[key]) {
        out[key] = { count: 0, withWorkoutPushed: 0 };
      }
      out[key].count++;
      if (row.workoutPushed) out[key].withWorkoutPushed++;
    }
    return out;
  }

  return {
    athleteId,
    garminConnected: Boolean(athlete?.garmin_access_token && athlete?.garmin_user_id),
    activePlan: activePlanRow
      ? {
          id: activePlanRow.id,
          athleteRaceId: activePlanRow.athleteRaceId,
          lifecycleStatus: activePlanRow.lifecycleStatus,
          startDate: activePlanRow.startDate.toISOString(),
          totalWeeks: activePlanRow.totalWeeks,
          goalRaceTime: activePlanRow.goalRaceTime,
          goalRacePace: activePlanRow.goalRacePace,
          planScheduleWeeks: planScheduleWeekCount(activePlanRow.planSchedule),
          currentWeek: null,
        }
      : null,
    otherPlans: allPlans
      .filter((p) => p.id !== activePlanRow?.id)
      .map((p) => ({
        id: p.id,
        lifecycleStatus: p.lifecycleStatus,
        athleteRaceId: p.athleteRaceId,
        startDate: p.startDate.toISOString(),
        totalWeeks: p.totalWeeks,
        planScheduleWeeks: planScheduleWeekCount(p.planSchedule),
      })),
    athleteRaces: athleteRaces.map((r) => ({
      id: r.id,
      name: r.name,
      raceDate: r.raceDate.toISOString(),
      goalTime: r.goalTime,
      isPrimaryRace: r.isPrimaryRace,
    })),
    goalsApiFirst: firstGoal
      ? {
          id: firstGoal.id,
          goalTime: firstGoal.goalTime ?? null,
          name: firstGoal.name ?? null,
        }
      : null,
    hydrate: {
      hasActivePlan: hydrate.hasActivePlan,
      planId: hydrate.planId,
      goalFinishTime: hydrate.goalFinishTime,
      goalPace: hydrate.goalPace,
    },
    activePlansApiCount,
    plannedWorkouts: { byPlanId: bucketByPlanId(plannedRows) },
    legacyWorkouts: { byPlanId: bucketByPlanId(workoutRows) },
    ...(activePlanRef
      ? {
          activePlanRef: {
            id: activePlanRef.id,
            athleteRaceId: activePlanRef.athleteRaceId,
          },
        }
      : {}),
  } as AthleteTrainingStateDiagnosis & {
    activePlanRef?: { id: string; athleteRaceId: string | null };
  };
}

export function formatAthleteTrainingDiagnosis(
  diagnosis: AthleteTrainingStateDiagnosis
): string {
  const lines: string[] = [
    `Athlete: ${diagnosis.athleteId}`,
    `Garmin connected: ${diagnosis.garminConnected}`,
    "",
    "=== ACTIVE PLAN ===",
    diagnosis.activePlan
      ? JSON.stringify(diagnosis.activePlan, null, 2)
      : "(none)",
    "",
    "=== HYDRATE (canonical API) ===",
    JSON.stringify(diagnosis.hydrate, null, 2),
    "",
    "=== /api/goals first row (mobile home trap) ===",
    diagnosis.goalsApiFirst
      ? JSON.stringify(diagnosis.goalsApiFirst, null, 2)
      : "(none)",
    "",
    "=== OTHER PLANS ===",
    diagnosis.otherPlans.length
      ? JSON.stringify(diagnosis.otherPlans, null, 2)
      : "(none)",
    "",
    "=== ATHLETE RACES ===",
    JSON.stringify(diagnosis.athleteRaces, null, 2),
    "",
    "=== FUTURE planned_workouts by planId ===",
    JSON.stringify(diagnosis.plannedWorkouts.byPlanId, null, 2),
    "",
    "=== FUTURE legacy workouts by planId ===",
    JSON.stringify(diagnosis.legacyWorkouts.byPlanId, null, 2),
  ];
  return lines.join("\n");
}
