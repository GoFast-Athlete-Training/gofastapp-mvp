/**
 * Find-or-create a single `workouts` row for a plan day from `planWeeks` (lazy materialization).
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { utcDateOnly } from "./plan-utils";
import { buildPlanWorkoutApiSegments } from "./workout-segment-generator";
import { planScheduleDayForDateKey } from "./plan-schedule";
import { metersToMiles } from "@/lib/pace-utils";
import { segmentSnapshotDocumentFromApiSegments } from "./workout-segment-snapshot";

function utcDayBounds(d: Date): { gte: Date; lte: Date } {
  const x = utcDateOnly(d);
  const gte = new Date(x);
  gte.setUTCHours(0, 0, 0, 0);
  const lte = new Date(x);
  lte.setUTCHours(23, 59, 59, 999);
  return { gte, lte };
}

function parseDateParam(dateParam: string): Date {
  const s = dateParam.trim();
  if (!s) throw new Error("date is required");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T12:00:00.000Z`);
  }
  const hasTz = /Z$/i.test(s) || /[+-]\d{2}:?\d{2}$/.test(s);
  const d = new Date(hasTz ? s : `${s}Z`);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
  return d;
}

export async function findOrCreateWorkoutForPlanDay(params: {
  planId: string;
  athleteId: string;
  dateParam: string;
}): Promise<{ workoutId: string }> {
  const { planId, athleteId, dateParam } = params;
  const anchor = parseDateParam(dateParam);
  const { gte, lte } = utcDayBounds(anchor);

  const existing = await prisma.workouts.findFirst({
    where: {
      planId,
      athleteId,
      date: { gte, lte },
    },
    select: { id: true },
  });
  if (existing) {
    return { workoutId: existing.id };
  }

  const plan = await prisma.training_plans.findFirst({
    where: { id: planId, athleteId },
    include: {
      race_registry: {
        select: {
          raceDate: true,
          name: true,
          distanceMeters: true,
        },
      },
    },
  });

  if (!plan) {
    throw new Error("Plan not found");
  }

  const dateKey = utcDateOnly(anchor).toISOString().slice(0, 10);
  const race = plan.race_registry;

  const raceDistanceMiles =
    race?.distanceMeters != null && Number.isFinite(Number(race.distanceMeters))
      ? metersToMiles(Number(race.distanceMeters))
      : null;

  const scheduled = planScheduleDayForDateKey({
    planStartDate: plan.startDate,
    planWeeks: plan.planWeeks,
    raceDate: race?.raceDate ?? null,
    raceName: race?.name ?? null,
    raceDistanceMiles,
    dateKey,
    maxWeekNumber: plan.totalWeeks,
  });

  if (!scheduled) {
    throw new Error("No scheduled workout for this date");
  }

  const needsPace =
    scheduled.workoutType === "Easy" ||
    scheduled.workoutType === "LongRun" ||
    scheduled.workoutType === "Race";
  if (needsPace && !plan.currentFiveKPace?.trim()) {
    throw new Error(
      "training_plans.currentFiveKPace is missing; set 5K pace on your profile or plan."
    );
  }

  const miles = scheduled.estimatedDistanceInMeters / 1609.34;
  const apiSegs = buildPlanWorkoutApiSegments({
    workoutType: scheduled.workoutType,
    miles,
    currentFiveKPace: plan.currentFiveKPace ?? null,
    catalogueEntry: null,
    goalRacePace: plan.goalRacePace ?? null,
    goalRaceTime: plan.goalRaceTime ?? null,
    raceDistanceMiles,
    planCycleIndex: scheduled.planCycleIndex ?? null,
  });

  const workoutId = await prisma.$transaction(async (tx) => {
    const w = await tx.workouts.create({
      data: {
        title: scheduled.title,
        workoutType: scheduled.workoutType,
        athleteId,
        planId,
        date: scheduled.date,
        estimatedDistanceInMeters: scheduled.estimatedDistanceInMeters,
        catalogueWorkoutId: null,
        weekNumber: scheduled.weekNumber,
        dayAssigned: scheduled.dayAssigned,
        nOffset: scheduled.nOffset,
        planCycleIndex: scheduled.planCycleIndex,
        updatedAt: new Date(),
      },
    });

    if (apiSegs.length) {
      const segmentRows: Prisma.workout_segmentsCreateManyInput[] = apiSegs.map(
        (s) => ({
          workoutId: w.id,
          stepOrder: s.stepOrder,
          title: s.title,
          durationType: s.durationType,
          durationValue: s.durationValue,
          targets: s.targets as object | undefined,
          repeatCount: s.repeatCount ?? undefined,
          paceTargetEncodingVersion: 2,
          updatedAt: new Date(),
        })
      );
      await tx.workout_segments.createMany({ data: segmentRows });
      await tx.workouts.update({
        where: { id: w.id },
        data: {
          segmentSnapshotJson: segmentSnapshotDocumentFromApiSegments(
            apiSegs,
            "plan_day_materialize"
          ),
        },
      });
    }

    return w.id;
  });

  return { workoutId };
}
