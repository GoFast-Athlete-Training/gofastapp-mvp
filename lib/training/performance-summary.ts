/**
 * Performance tab rollup — active plan week snapshot + Where you stand.
 */

import { TrainingPlanLifecycle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { metersToMiles } from "@/lib/pace-utils";
import {
  performanceReflectionWeekNumber,
  effectiveTrainingWeekCount,
} from "@/lib/training/plan-utils";
import { buildPlanWeekCards } from "@/lib/training/plan-week-cards";
import { deriveSessionStatus, sessionStatusLabel } from "@/lib/training/session-status";
import { loadWeekPerformanceSnapshot } from "@/lib/training/week-performance-metrics";
import type { WeekPerformanceSnapshot } from "@/lib/training/week-performance-types";
import {
  loadWhereYouStandSnapshot,
  type WhereYouStandSnapshot,
} from "@/lib/training/where-you-stand";
import { resolvePlanTerminalRaceDisplay } from "@/lib/training/plan-race-snapshots";

export type PerformanceWeekDay = {
  workoutId: string | null;
  dateKey: string;
  title: string;
  workoutType: string;
  status: string;
  statusLabel: string;
  paceDeltaSecPerMile: number | null;
};

export type PerformanceSummary = {
  planId: string | null;
  planName: string | null;
  weekNumber: number | null;
  weekPerformance: WeekPerformanceSnapshot | null;
  weekDays: PerformanceWeekDay[];
  whereYouStand: WhereYouStandSnapshot | null;
  /** @deprecated Use whereYouStand.fiveK */
  currentFiveKPace: string | null;
};

export async function loadPerformanceSummary(
  athleteId: string
): Promise<PerformanceSummary> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: { fiveKPace: true },
  });

  const activePlan = await prisma.training_plans.findFirst({
    where: { athleteId, lifecycleStatus: TrainingPlanLifecycle.ACTIVE },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      startDate: true,
      totalWeeks: true,
      planSchedule: true,
      goalRaceTime: true,
      race_registry: {
        select: { raceDate: true, name: true, distanceMeters: true },
      },
      athlete_race: {
        select: {
          name: true,
          raceDate: true,
          distanceMeters: true,
          distanceLabel: true,
        },
      },
    },
  });

  let weekPerformance: WeekPerformanceSnapshot | null = null;
  let weekNumber: number | null = null;
  let weekDays: PerformanceWeekDay[] = [];
  let whereYouStand: WhereYouStandSnapshot | null = null;

  if (activePlan) {
    const terminal = resolvePlanTerminalRaceDisplay(activePlan);
    const raceDate = terminal?.raceDate ?? activePlan.race_registry?.raceDate ?? null;
    const raceName = terminal?.name ?? activePlan.race_registry?.name ?? null;
    const raceDistanceMiles =
      terminal?.distanceMeters != null && Number.isFinite(Number(terminal.distanceMeters))
        ? metersToMiles(Number(terminal.distanceMeters))
        : activePlan.race_registry?.distanceMeters != null &&
            Number.isFinite(Number(activePlan.race_registry.distanceMeters))
          ? metersToMiles(Number(activePlan.race_registry.distanceMeters))
          : null;

    const effectiveWeeks = effectiveTrainingWeekCount(
      activePlan.startDate,
      activePlan.totalWeeks,
      raceDate
    );
    weekNumber = performanceReflectionWeekNumber(activePlan.startDate, effectiveWeeks);

    const [wp, cards, stand] = await Promise.all([
      loadWeekPerformanceSnapshot({
        planId: activePlan.id,
        athleteId,
        planStartDate: activePlan.startDate,
        weekNumber,
        storedTotalWeeks: activePlan.totalWeeks,
        raceDate,
      }),
      buildPlanWeekCards({
        planId: activePlan.id,
        athleteId,
        planStartDate: activePlan.startDate,
        planSchedule: activePlan.planSchedule,
        weekNumber,
        storedTotalWeeks: activePlan.totalWeeks,
        raceDate,
        raceName,
        raceDistanceMiles,
      }),
      loadWhereYouStandSnapshot({
        athleteId,
        planId: activePlan.id,
        planStartDate: activePlan.startDate,
        weekNumber,
        storedTotalWeeks: activePlan.totalWeeks,
        raceDate,
        raceDistanceMiles,
        raceName,
        goalRaceTime: activePlan.goalRaceTime,
      }),
    ]);

    weekPerformance = wp;
    whereYouStand = stand;

    const workoutIds = cards
      .map((c) => c.workoutId)
      .filter((id): id is string => id != null);

    const paceDeltaByWorkoutId = new Map<string, number | null>();
    if (workoutIds.length > 0) {
      const instances = await prisma.workouts.findMany({
        where: { id: { in: workoutIds }, athleteId },
        select: { id: true, paceDeltaSecPerMile: true },
      });
      for (const w of instances) {
        paceDeltaByWorkoutId.set(w.id, w.paceDeltaSecPerMile);
      }
    }

    weekDays = cards
      .filter((c) => c.workoutType !== "Rest" && c.title !== "Rest")
      .filter((c) => c.matchedActivityId != null)
      .map((c) => {
        const status = deriveSessionStatus({
          dateKey: c.dateKey,
          matchedActivityId: c.matchedActivityId,
          skippedAt: c.skippedAt,
          workoutType: c.workoutType,
          title: c.title,
        });
        return {
          workoutId: c.workoutId,
          dateKey: c.dateKey,
          title: c.title,
          workoutType: c.workoutType,
          status,
          statusLabel: sessionStatusLabel(status),
          paceDeltaSecPerMile:
            c.workoutId != null
              ? paceDeltaByWorkoutId.get(c.workoutId) ?? null
              : null,
        };
      });
  }

  return {
    planId: activePlan?.id ?? null,
    planName: activePlan?.name ?? null,
    weekNumber,
    weekPerformance,
    weekDays,
    whereYouStand,
    currentFiveKPace: athlete?.fiveKPace ?? null,
  };
}
