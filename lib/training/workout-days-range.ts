/**
 * Idempotent: load or create plan workouts for [startDate, endDate] UTC inclusive.
 */

import type { Prisma, workouts } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getTrainingPaces,
  parsePaceToSecondsPerMile,
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
import { selectNextCatalogueWorkout } from "./select-catalogue-workout";
import { catalogueEntryToApiSegments } from "./catalogue-to-segments";

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

/** Current-fitness anchor for zone offsets: Athlete.fiveKPace (M:SS / mile), not goal race pace. */
function baselineSecondsPerMileFromAthlete(fiveKPace: string | null | undefined): number {
  const raw = fiveKPace?.trim();
  if (!raw) {
    throw new Error(
      "Set your current 5K pace on your profile (athlete-edit-profile) so plan workouts can use training zones."
    );
  }
  return parsePaceToSecondsPerMile(raw);
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
      Athlete: { select: { fiveKPace: true } },
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
  const anchorSecPerMile = baselineSecondsPerMileFromAthlete(plan.Athlete?.fiveKPace);
  const paces = getTrainingPaces(anchorSecPerMile);
  const phaseNorm = (phase || "base").trim().toLowerCase();

  const cataloguePicks: Awaited<
    ReturnType<typeof selectNextCatalogueWorkout>
  >[] = [];
  for (const token of tokens) {
    cataloguePicks.push(
      await selectNextCatalogueWorkout(athleteId, token.workoutType, phaseNorm)
    );
  }

  const created: workouts[] = [];

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const catalogueEntry = cataloguePicks[i];
      const ourDow = dayAbbrToOurDow(token.dayAbbr);
      const date = dateForDayInWeek(plan.startDate, weekNumber, ourDow);
      const estMeters = milesToMeters(token.miles);

      const title =
        catalogueEntry != null
          ? `${catalogueEntry.name} — Week ${weekNumber}`
          : titleForType(token.workoutType, token.miles, weekNumber);

      const w = await tx.workouts.create({
        data: {
          title,
          workoutType: token.workoutType,
          athleteId,
          planId,
          date,
          phase: phase || null,
          estimatedDistanceInMeters: estMeters,
          catalogueWorkoutId: catalogueEntry?.id ?? null,
          updatedAt: new Date(),
        },
      });

      const apiSegs =
        catalogueEntry != null
          ? catalogueEntryToApiSegments({
              entry: catalogueEntry,
              scheduleMiles: token.miles,
              anchorSecondsPerMile: anchorSecPerMile,
            })
          : descriptorsToApiSegments(
              getTemplateSegments(token.workoutType, token.miles, paces),
              paces
            );

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
