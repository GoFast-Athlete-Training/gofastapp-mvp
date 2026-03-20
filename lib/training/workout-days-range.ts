/**
 * Idempotent: load or create plan workouts for [startDate, endDate] UTC inclusive.
 */

import type { Prisma, workouts } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getTrainingPaces,
  resolveGoalPaceSecondsPerMile,
  distanceMilesToPaceRaceKey,
} from "@/lib/workout-generator/pace-calculator";
import {
  getTemplateSegments,
  descriptorsToApiSegments,
} from "@/lib/workout-generator/templates";
import {
  parseScheduleString,
  dateForDayInWeek,
  dayAbbrToOurDow,
} from "./schedule-parser";

function milesToMeters(miles: number): number {
  return miles * 1609.34;
}

function utcDayRange(weekStart: Date, weekEnd: Date): { gte: Date; lte: Date } {
  const gte = new Date(weekStart);
  gte.setUTCHours(0, 0, 0, 0);
  const lte = new Date(weekEnd);
  lte.setUTCHours(23, 59, 59, 999);
  return { gte, lte };
}

function titleForType(workoutType: string, miles: number, weekNumber: number): string {
  return `${workoutType} — Week ${weekNumber} (${miles} mi)`;
}

export type WeekBounds = { weekStart: Date; weekEnd: Date };

export function weekBoundsFromPlan(
  planStartDate: Date,
  weekNumber: number
): WeekBounds {
  const start = new Date(planStartDate);
  start.setUTCHours(0, 0, 0, 0);
  const weekStart = new Date(start);
  weekStart.setUTCDate(weekStart.getUTCDate() + (weekNumber - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
}

function weekNumberFromDate(planStartDate: Date, date: Date): number {
  const s = new Date(planStartDate);
  s.setUTCHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const diffMs = d.getTime() - s.getTime();
  const diffDays = Math.floor(diffMs / (86400000));
  if (diffDays < 0) return 1;
  return Math.floor(diffDays / 7) + 1;
}

/**
 * Resolve goal pace (sec/mile) for training zones from plan's athlete goal + race.
 */
function goalPaceSecondsPerMileFromPlan(plan: {
  athlete_goal: {
    goalRacePace: number | null;
    goalTime: string | null;
    distance: string;
  } | null;
  race_registry: { distanceMiles: number; raceType: string } | null;
}): number {
  const g = plan.athlete_goal;
  const race = plan.race_registry;
  if (g?.goalRacePace != null && g.goalRacePace > 0) {
    return g.goalRacePace;
  }
  if (g?.goalTime && race) {
    const distKey = distanceMilesToPaceRaceKey(race.distanceMiles);
    return resolveGoalPaceSecondsPerMile({
      raceTime: g.goalTime,
      raceDistance: distKey,
    });
  }
  if (g?.goalTime && g.distance) {
    return resolveGoalPaceSecondsPerMile({
      raceTime: g.goalTime,
      raceDistance: g.distance.toLowerCase().trim(),
    });
  }
  throw new Error("Cannot derive goal pace: set athlete goal with goalTime or goalRacePace");
}

export async function workoutDaysRangeForWeek(params: {
  planId: string;
  athleteId: string;
  weekNumber: number;
}): Promise<workouts[]> {
  const { planId, athleteId, weekNumber } = params;

  const planRow = await prisma.training_plans.findFirst({
    where: { id: planId, athleteId },
    select: { startDate: true },
  });
  if (!planRow) {
    throw new Error("Plan not found");
  }

  const { weekStart, weekEnd } = weekBoundsFromPlan(planRow.startDate, weekNumber);
  const { gte, lte } = utcDayRange(weekStart, weekEnd);

  const existing = await prisma.workouts.findMany({
    where: {
      planId,
      athleteId,
      date: { gte, lte },
    },
    orderBy: { date: "asc" },
  });

  if (existing.length > 0) {
    return existing;
  }

  const plan = await prisma.training_plans.findFirst({
    where: { id: planId, athleteId },
    include: {
      athlete_goal: {
        select: {
          goalRacePace: true,
          goalTime: true,
          distance: true,
        },
      },
      race_registry: {
        select: { distanceMiles: true, raceType: true },
      },
    },
  });

  if (!plan) {
    throw new Error("Plan not found");
  }

  if (!plan.planWeeks || !Array.isArray(plan.planWeeks)) {
    throw new Error("Plan has no planWeeks; run plan generation first");
  }

  const entry = (plan.planWeeks as unknown[]).find(
    (w) =>
      w &&
      typeof w === "object" &&
      Number((w as Record<string, unknown>).weekNumber) === weekNumber
  ) as Record<string, unknown> | undefined;

  if (!entry || typeof entry.schedule !== "string") {
    throw new Error(`No planWeek entry for week ${weekNumber}`);
  }

  const schedule = entry.schedule as string;
  const phase =
    typeof entry.phase === "string" ? entry.phase : String(entry.phase ?? "");

  const tokens = parseScheduleString(schedule);
  const goalSecPerMile = goalPaceSecondsPerMileFromPlan(plan);
  const paces = getTrainingPaces(goalSecPerMile);

  const created: workouts[] = [];

  await prisma.$transaction(async (tx) => {
    for (const token of tokens) {
      const ourDow = dayAbbrToOurDow(token.dayAbbr);
      const date = dateForDayInWeek(plan.startDate, weekNumber, ourDow);
      const estMeters = milesToMeters(token.miles);

      const w = await tx.workouts.create({
        data: {
          title: titleForType(token.workoutType, token.miles, weekNumber),
          workoutType: token.workoutType,
          athleteId,
          planId,
          date,
          phase: phase || null,
          estimatedDistanceInMeters: estMeters,
          updatedAt: new Date(),
        },
      });

      const descriptors = getTemplateSegments(
        token.workoutType,
        token.miles,
        paces
      );
      const apiSegs = descriptorsToApiSegments(descriptors, paces);

      const segmentRows: Prisma.workout_segmentsCreateManyInput[] = apiSegs.map(
        (s) => ({
          workoutId: w.id,
          stepOrder: s.stepOrder,
          title: s.title,
          durationType: s.durationType,
          durationValue: s.durationValue,
          targets: s.targets as object | undefined,
          repeatCount: s.repeatCount ?? undefined,
          updatedAt: new Date(),
        })
      );

      if (segmentRows.length) {
        await tx.workout_segments.createMany({ data: segmentRows });
      }

      created.push(w);
    }
  });

  return prisma.workouts.findMany({
    where: {
      planId,
      athleteId,
      date: { gte, lte },
    },
    orderBy: { date: "asc" },
  });
}

/** @deprecated use workoutDaysRangeForWeek */
export async function workoutDaysRange(params: {
  planId: string;
  athleteId: string;
  rangeStart: Date;
  rangeEnd: Date;
}): Promise<workouts[]> {
  const planRow = await prisma.training_plans.findFirst({
    where: { id: params.planId, athleteId: params.athleteId },
    select: { startDate: true },
  });
  if (!planRow) throw new Error("Plan not found");
  const weekNumber = weekNumberFromDate(planRow.startDate, params.rangeStart);
  return workoutDaysRangeForWeek({
    planId: params.planId,
    athleteId: params.athleteId,
    weekNumber,
  });
}
