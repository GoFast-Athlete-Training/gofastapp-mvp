/**
 * Idempotent: load or create plan workouts for [startDate, endDate] UTC inclusive.
 */

import type { Prisma, WorkoutType, workouts } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  parseScheduleString,
  dateForDayInWeek,
  dayAbbrToOurDow,
  dayAbbrToDayName,
} from "./schedule-parser";
import { addDaysUtc, mondayUtcOfWeekContaining, utcDateOnly } from "./plan-utils";
import {
  cataloguePhaseFallbackForWeek,
  nOffsetFromWeekAnchor,
} from "./generate-plan";
import { formatPlannedWorkoutTitle } from "./workout-display-title";
import { selectNextCatalogueWorkout } from "./select-catalogue-workout";
import { buildPlanWorkoutApiSegments } from "./workout-segment-generator";
import { titleFromLadderIndex } from "./algo-workout-segments";

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

export type WeekBounds = { weekStart: Date; weekEnd: Date };

export function weekBoundsFromPlan(
  planStartDate: Date,
  weekNumber: number
): WeekBounds {
  const firstMonday = mondayUtcOfWeekContaining(planStartDate);
  const weekStart = addDaysUtc(firstMonday, (weekNumber - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
}

function weekNumberFromDate(planStartDate: Date, date: Date): number {
  const firstMon = mondayUtcOfWeekContaining(planStartDate);
  const d = utcDateOnly(date);
  if (d.getTime() < firstMon.getTime()) return 1;
  const diffDays = Math.floor(
    (d.getTime() - firstMon.getTime()) / 86400000
  );
  return Math.floor(diffDays / 7) + 1;
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
      race_registry: { select: { raceDate: true } },
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
  const raceDate = plan.race_registry?.raceDate;
  const phaseForCat =
    raceDate != null
      ? cataloguePhaseFallbackForWeek(plan.startDate, raceDate, weekNumber)
      : "base";

  const tokens = parseScheduleString(schedule);
  const weekAnchorUtc = utcDateOnly(weekStart);
  const raceUtc = raceDate ? utcDateOnly(raceDate) : null;
  const weekNOffset =
    raceUtc != null ? nOffsetFromWeekAnchor(weekAnchorUtc, raceUtc) : null;

  const needsPaceForMaterialization = tokens.some(
    (tok) => tok.workoutType === "Easy" || tok.workoutType === "LongRun"
  );

  if (
    needsPaceForMaterialization &&
    !plan.currentFiveKPace?.trim()
  ) {
    throw new Error(
      "training_plans.currentFiveKPace is missing; set athlete 5K pace and sync to the plan (generate plan or update profile)."
    );
  }

  const phaseNorm = phaseForCat.trim().toLowerCase();

  const cataloguePicks: Awaited<
    ReturnType<typeof selectNextCatalogueWorkout>
  >[] = [];
  for (const token of tokens) {
    const skipCat =
      token.workoutType === "Intervals" || token.workoutType === "Tempo";
    if (skipCat) {
      cataloguePicks.push(null);
    } else {
      cataloguePicks.push(
        await selectNextCatalogueWorkout(athleteId, token.workoutType, phaseNorm)
      );
    }
  }

  const created: workouts[] = [];

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const catalogueEntry = cataloguePicks[i];
      const ourDow = dayAbbrToOurDow(token.dayAbbr);
      const date = dateForDayInWeek(plan.startDate, weekNumber, ourDow);
      const estMeters = milesToMeters(token.miles);

      const planLadderIndex =
        token.workoutType === "Intervals" || token.workoutType === "Tempo"
          ? (token.ladderIndex ?? null)
          : null;
      const title =
        token.workoutType === "Intervals" || token.workoutType === "Tempo"
          ? titleFromLadderIndex(
              token.workoutType,
              token.ladderIndex ?? 0
            )!
          : formatPlannedWorkoutTitle(
              token.workoutType,
              milesToMeters(token.miles)
            );

      const w = await tx.workouts.create({
        data: {
          title,
          workoutType: token.workoutType,
          athleteId,
          planId,
          date,
          phase: null,
          estimatedDistanceInMeters: estMeters,
          catalogueWorkoutId:
            token.workoutType === "Intervals" || token.workoutType === "Tempo"
              ? null
              : catalogueEntry?.id ?? null,
          weekNumber,
          dayAssigned: dayAbbrToDayName(token.dayAbbr),
          nOffset: weekNOffset,
          planLadderIndex,
          updatedAt: new Date(),
        },
      });

      const apiSegs = buildPlanWorkoutApiSegments({
        workoutType: token.workoutType,
        miles: token.miles,
        currentFiveKPace: plan.currentFiveKPace,
        catalogueEntry,
      });

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
