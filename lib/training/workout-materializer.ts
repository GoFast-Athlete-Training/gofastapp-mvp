/**
 * Materialize one `workouts` row (+ segments) for a plan calendar day from `planSchedule`,
 * and stamp `workoutId` back onto the structured JSON day when applicable.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { utcDateOnly } from "./plan-utils";
import {
  planScheduleDayForDateKey,
  type PlanScheduleDay,
} from "./plan-schedule";
import { isStructuredPlanWeek } from "./plan-schedule-schema";
import { dateForDayInWeek } from "./schedule-parser";
import {
  prescribe,
  anchorSecondsPerMileFromPlanPace,
  type WorkoutStep,
} from "./prescription";
import { metersToMiles } from "@/lib/pace-utils";
import {
  segmentSnapshotDocumentFromApiSegments,
  type SegmentSnapshotSource,
} from "./workout-segment-snapshot";
import { resolveRacePaceSecondsPerMileForPlan } from "./goal-pace-calculator";
import { EASY_RUN_NOT_CONFIGURED } from "./run-type-config-validation";
import { ensureWorkoutPrescriptionNarrative } from "./prescription-narrative-service";

function enqueuePrescriptionNarrative(workoutId: string, athleteId: string): void {
  void ensureWorkoutPrescriptionNarrative({ workoutId, athleteId }).catch((e) =>
    console.warn("ensureWorkoutPrescriptionNarrative:", e)
  );
}

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

function dateKeyUtc(d: Date): string {
  return utcDateOnly(d).toISOString().slice(0, 10);
}

function workoutNeedsRematerialize(params: {
  existing: {
    catalogueWorkoutId: string | null;
    estimatedDistanceInMeters: number | null;
    segmentCount: number;
  };
  scheduled: PlanScheduleDay;
}): boolean {
  if (params.existing.segmentCount === 0) return true;
  const scheduledCat = params.scheduled.catalogueWorkoutId?.trim() ?? null;
  const existingCat = params.existing.catalogueWorkoutId?.trim() ?? null;
  if (scheduledCat !== existingCat) return true;
  const scheduledMeters = params.scheduled.estimatedDistanceInMeters;
  const existingMeters = params.existing.estimatedDistanceInMeters;
  if (
    scheduledMeters != null &&
    existingMeters != null &&
    Math.abs(scheduledMeters - existingMeters) > 80
  ) {
    return true;
  }
  return false;
}

async function createSegmentsForWorkout(params: {
  tx: Prisma.TransactionClient;
  workoutId: string;
  steps: WorkoutStep[];
  snapshotSource: SegmentSnapshotSource;
}): Promise<void> {
  const { tx, workoutId, steps, snapshotSource } = params;
  if (steps.length === 0) return;
  const segmentRows: Prisma.workout_segmentsCreateManyInput[] = steps.map((s) => ({
    workoutId,
    stepOrder: s.stepOrder,
    title: s.title,
    durationType: s.durationType,
    durationValue: s.durationValue,
    targets: s.targets as object | undefined,
    repeatCount: s.repeatCount ?? undefined,
    paceTargetEncodingVersion: 2,
    updatedAt: new Date(),
  }));
  await tx.workout_segments.createMany({ data: segmentRows });
  await tx.workouts.update({
    where: { id: workoutId },
    data: {
      segmentSnapshotJson: segmentSnapshotDocumentFromApiSegments(
        steps,
        snapshotSource
      ),
    },
  });
}

function stampWorkoutIdOnStructuredPlanSchedule(params: {
  planSchedule: unknown;
  planStartDate: Date;
  dateKey: string;
  scheduled: PlanScheduleDay;
  workoutId: string;
  raceDate: Date | null;
}): unknown {
  const { planSchedule, planStartDate, dateKey, scheduled, workoutId, raceDate } =
    params;
  if (!Array.isArray(planSchedule)) return planSchedule;
  const raceUtc = raceDate ? utcDateOnly(raceDate) : null;

  return planSchedule.map((weekRow) => {
    if (!isStructuredPlanWeek(weekRow)) return weekRow;
    const wn = weekRow.weekNumber;
    let touched = false;
    const nextDays = weekRow.days.map((d) => {
      const date = dateForDayInWeek(planStartDate, wn, d.dow);
      if (dateKeyUtc(date) !== dateKey) return d;
      const typeMatches =
        d.workoutType === scheduled.workoutType ||
        (scheduled.workoutType === "Race" &&
          d.workoutType === "LongRun" &&
          raceUtc != null &&
          utcDateOnly(date).getTime() === raceUtc.getTime());
      if (!typeMatches) return d;
      touched = true;
      return { ...d, workoutId };
    });
    return touched ? { ...weekRow, days: nextDays } : weekRow;
  });
}

export async function materializeWorkoutForPlanDay(params: {
  planId: string;
  athleteId: string;
  /** `YYYY-MM-DD` (UTC) or full ISO datetime */
  dateParam: string;
}): Promise<{ workoutId: string }> {
  const { planId, athleteId, dateParam } = params;
  const anchor = parseDateParam(dateParam.trim());
  const { gte, lte } = utcDayBounds(anchor);
  const dateKey = utcDateOnly(anchor).toISOString().slice(0, 10);

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

  const race = plan.race_registry;

  const raceDistanceMiles =
    race?.distanceMeters != null && Number.isFinite(Number(race.distanceMeters))
      ? metersToMiles(Number(race.distanceMeters))
      : null;

  const scheduled = planScheduleDayForDateKey({
    planStartDate: plan.startDate,
    planSchedule: plan.planSchedule,
    raceDate: race?.raceDate ?? null,
    raceName: race?.name ?? null,
    raceDistanceMiles,
    dateKey,
    maxWeekNumber: plan.totalWeeks,
    catalogueTitleById: {},
  });

  if (!scheduled) {
    throw new Error("No scheduled workout for this date");
  }

  const stampId = scheduled.workoutId?.trim();
  let existing: {
    id: string;
    catalogueWorkoutId: string | null;
    estimatedDistanceInMeters: number | null;
    _count: { segments: number };
  } | null = null;

  if (stampId) {
    existing = await prisma.workouts.findFirst({
      where: {
        id: stampId,
        planId,
        athleteId,
      },
      select: {
        id: true,
        catalogueWorkoutId: true,
        estimatedDistanceInMeters: true,
        _count: { select: { segments: true } },
      },
    });
    if (
      existing &&
      existing._count.segments > 0 &&
      !workoutNeedsRematerialize({ existing: { ...existing, segmentCount: existing._count.segments }, scheduled })
    ) {
      enqueuePrescriptionNarrative(existing.id, athleteId);
      return { workoutId: existing.id };
    }
  }

  if (!existing) {
    existing = await prisma.workouts.findFirst({
      where: {
        planId,
        athleteId,
        date: { gte, lte },
      },
      select: {
        id: true,
        catalogueWorkoutId: true,
        estimatedDistanceInMeters: true,
        _count: { select: { segments: true } },
      },
    });
    if (
      existing &&
      existing._count.segments > 0 &&
      !workoutNeedsRematerialize({ existing: { ...existing, segmentCount: existing._count.segments }, scheduled })
    ) {
      enqueuePrescriptionNarrative(existing.id, athleteId);
      return { workoutId: existing.id };
    }
  }

  if (existing && existing._count.segments > 0) {
    await prisma.workout_segments.deleteMany({ where: { workoutId: existing.id } });
    await prisma.workouts.update({
      where: { id: existing.id },
      data: {
        catalogueWorkoutId: scheduled.catalogueWorkoutId ?? null,
        estimatedDistanceInMeters: scheduled.estimatedDistanceInMeters,
        title: scheduled.title,
        updatedAt: new Date(),
      },
    });
  }

  const needsCatalogueAnchoredIT =
    (scheduled.workoutType === "Intervals" ||
      scheduled.workoutType === "Tempo") &&
    Boolean(scheduled.catalogueWorkoutId);
  const needsCatalogueAnchoredEasy =
    scheduled.workoutType === "Easy" &&
    Boolean(scheduled.catalogueWorkoutId);
  const needsPace =
    scheduled.workoutType === "Easy" ||
    scheduled.workoutType === "LongRun" ||
    scheduled.workoutType === "Race" ||
    needsCatalogueAnchoredIT ||
    needsCatalogueAnchoredEasy;
  if (needsPace && !plan.currentFiveKPace?.trim()) {
    throw new Error(
      "training_plans.currentFiveKPace is missing; set 5K pace on your profile or plan."
    );
  }

  let catalogueEntryForDay: Awaited<
    ReturnType<typeof prisma.workout_catalogue.findUnique>
  > = null;
  if (scheduled.catalogueWorkoutId) {
    catalogueEntryForDay = await prisma.workout_catalogue.findUnique({
      where: { id: scheduled.catalogueWorkoutId },
    });
  }

  const miles = scheduled.estimatedDistanceInMeters / 1609.34;

  if (scheduled.workoutType === "Easy" && !scheduled.catalogueWorkoutId?.trim()) {
    throw new Error(EASY_RUN_NOT_CONFIGURED);
  }

  let steps: ReturnType<typeof prescribe> = [];
  if (catalogueEntryForDay && plan.currentFiveKPace?.trim()) {
    const anchorSecPerMile = anchorSecondsPerMileFromPlanPace(
      plan.currentFiveKPace ?? null
    );
    const racePaceSec = resolveRacePaceSecondsPerMileForPlan({
      goalRacePace: plan.goalRacePace ?? null,
      goalRaceTime: plan.goalRaceTime ?? null,
      raceDistanceMiles,
    });
    steps = prescribe({
      entry: catalogueEntryForDay,
      scheduleMiles: miles,
      anchorSecondsPerMile: anchorSecPerMile,
      racePaceSecondsPerMile: racePaceSec,
      planCycleIndex: scheduled.planCycleIndex ?? null,
      easyWorkPaceOffsetOverrideSecPerMile: null,
    });
  } else if (scheduled.workoutType === "Easy") {
    throw new Error(EASY_RUN_NOT_CONFIGURED);
  }

  if (existing) {
    await prisma.$transaction(async (tx) => {
      await createSegmentsForWorkout({
        tx,
        workoutId: existing.id,
        steps,
        snapshotSource: "plan_day_materialize_existing",
      });
    });
    enqueuePrescriptionNarrative(existing.id, athleteId);
    return { workoutId: existing.id };
  }

  const planJson = plan.planSchedule;
  const jsonLooksStructured =
    Array.isArray(planJson) && planJson.some((w) => isStructuredPlanWeek(w));

  const workoutId = await prisma.$transaction(async (tx) => {
    const w = await tx.workouts.create({
      data: {
        title: scheduled.title,
        workoutType: scheduled.workoutType,
        athleteId,
        planId,
        date: scheduled.date,
        estimatedDistanceInMeters: scheduled.estimatedDistanceInMeters,
        catalogueWorkoutId: scheduled.catalogueWorkoutId ?? null,
        weekNumber: scheduled.weekNumber,
        dayAssigned: scheduled.dayAssigned,
        nOffset: scheduled.nOffset,
        planCycleIndex: scheduled.planCycleIndex,
        updatedAt: new Date(),
      },
    });

    await createSegmentsForWorkout({
      tx,
      workoutId: w.id,
      steps,
      snapshotSource: "plan_day_materialize",
    });

    if (jsonLooksStructured) {
      const nextSchedule = stampWorkoutIdOnStructuredPlanSchedule({
        planSchedule: planJson,
        planStartDate: plan.startDate,
        dateKey,
        scheduled,
        workoutId: w.id,
        raceDate: race?.raceDate ?? null,
      });
      await tx.training_plans.update({
        where: { id: planId },
        data: {
          planSchedule: nextSchedule as Prisma.InputJsonValue,
          updatedAt: new Date(),
        },
      });
    }

    return w.id;
  });

  enqueuePrescriptionNarrative(workoutId, athleteId);
  return { workoutId };
}
