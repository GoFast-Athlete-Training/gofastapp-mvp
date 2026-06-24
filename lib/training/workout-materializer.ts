/**
 * Materialize one `workouts` row (+ segments) for a plan calendar day from `planSchedule`.
 * Resolves existing rows by `(athleteId, planId, date)` — not JSON `workoutId` stamps.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { utcDateOnly } from "./plan-utils";
import {
  planScheduleDayForDateKey,
  type PlanScheduleDay,
} from "./plan-schedule";
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
import { resolveGoalRacePace } from "./goal-pace-calculator";
import { EASY_RUN_NOT_CONFIGURED } from "./run-type-config-validation";
import { ensureWorkoutPrescriptionNarrative } from "./prescription-narrative-service";
import { loadCatalogueTitleByIdFromPlanSchedule } from "./catalogue-title-map";
import { parsePaceProfileFromJson } from "./pace-key-resolver";

export class MaterializeWorkoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MaterializeWorkoutError";
  }
}

export const NO_PRESCRIPTION_STEPS = "NO_PRESCRIPTION_STEPS";

export type MaterializeWorkoutForPlanDayResult = {
  workoutId: string;
  status: "already_ready" | "materialized";
};

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
  if (!s) throw new MaterializeWorkoutError("date is required");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T12:00:00.000Z`);
  }
  const hasTz = /Z$/i.test(s) || /[+-]\d{2}:?\d{2}$/.test(s);
  const d = new Date(hasTz ? s : `${s}Z`);
  if (Number.isNaN(d.getTime())) throw new MaterializeWorkoutError("Invalid date");
  return d;
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

function assertPrescriptionSteps(
  steps: WorkoutStep[],
  scheduled: PlanScheduleDay,
  dateKey: string
): void {
  if (steps.length > 0) return;
  throw new MaterializeWorkoutError(
    `${NO_PRESCRIPTION_STEPS}: Could not prescribe segments for ${scheduled.workoutType} on ${dateKey}. Check catalogue assignment and 5K pace.`
  );
}

async function createSegmentsForWorkout(params: {
  tx: Prisma.TransactionClient;
  workoutId: string;
  steps: WorkoutStep[];
  snapshotSource: SegmentSnapshotSource;
  scheduled: PlanScheduleDay;
  dateKey: string;
}): Promise<void> {
  const { tx, workoutId, steps, snapshotSource, scheduled, dateKey } = params;
  assertPrescriptionSteps(steps, scheduled, dateKey);
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

async function buildPrescriptionSteps(params: {
  scheduled: PlanScheduleDay;
  plan: Awaited<
    ReturnType<
      typeof prisma.training_plans.findFirst<{
        include: {
          athlete_goal: {
            select: {
              goalTime: true;
              goalRacePace: true;
              distance: true;
            };
          };
        };
      }>
    >
  >;
  race: {
    raceDate: Date;
    name: string;
    distanceMeters: number | null;
    distanceLabel: string | null;
  } | null;
}): Promise<WorkoutStep[]> {
  const { scheduled, plan, race } = params;
  if (!plan) {
    throw new MaterializeWorkoutError("Plan not found");
  }

  const needsCatalogueAnchoredIT =
    (scheduled.workoutType === "Intervals" ||
      scheduled.workoutType === "Tempo") &&
    Boolean(scheduled.catalogueWorkoutId);
  const needsCatalogueAnchoredEasy =
    scheduled.workoutType === "Easy" && Boolean(scheduled.catalogueWorkoutId);
  const needsPace =
    scheduled.workoutType === "Easy" ||
    scheduled.workoutType === "LongRun" ||
    scheduled.workoutType === "Race" ||
    needsCatalogueAnchoredIT ||
    needsCatalogueAnchoredEasy;
  if (needsPace && !plan.currentFiveKPace?.trim()) {
    throw new MaterializeWorkoutError(
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
    if (!catalogueEntryForDay) {
      throw new MaterializeWorkoutError(
        `Catalogue workout ${scheduled.catalogueWorkoutId} not found for ${scheduled.workoutType}.`
      );
    }
  }

  const miles = scheduled.estimatedDistanceInMeters / 1609.34;

  if (scheduled.workoutType === "Easy" && !scheduled.catalogueWorkoutId?.trim()) {
    throw new MaterializeWorkoutError(EASY_RUN_NOT_CONFIGURED);
  }

  if (!catalogueEntryForDay || !plan.currentFiveKPace?.trim()) {
    if (scheduled.workoutType === "Easy") {
      throw new MaterializeWorkoutError(EASY_RUN_NOT_CONFIGURED);
    }
    return [];
  }

  const anchorSecPerMile = anchorSecondsPerMileFromPlanPace(plan.currentFiveKPace ?? null);
  const goalFinishTime =
    plan.athlete_goal?.goalTime?.trim() || plan.goalRaceTime?.trim() || null;
  const racePaceSec = resolveGoalRacePace({
    goalTime: goalFinishTime,
    dbGoalRacePaceSecPerMile: plan.athlete_goal?.goalRacePace ?? null,
    planGoalRacePace: plan.goalRacePace ?? null,
    distanceMeters: race?.distanceMeters ?? null,
    distanceLabel: race?.distanceLabel ?? null,
    goalDistance: plan.athlete_goal?.distance ?? null,
  }).goalPaceSecPerMile;

  const paceProfile = parsePaceProfileFromJson(
    (plan as { training_plan_preset?: { paceProfile?: unknown } | null }).training_plan_preset
      ?.paceProfile ?? null
  );

  return prescribe({
    entry: catalogueEntryForDay,
    scheduleMiles: miles,
    anchorSecondsPerMile: anchorSecPerMile,
    racePaceSecondsPerMile: racePaceSec,
    planCycleIndex: scheduled.planCycleIndex ?? null,
    easyWorkPaceOffsetOverrideSecPerMile: null,
    paceProfile,
  });
}

export async function materializeWorkoutForPlanDay(params: {
  planId: string;
  athleteId: string;
  /** `YYYY-MM-DD` (UTC) or full ISO datetime */
  dateParam: string;
}): Promise<MaterializeWorkoutForPlanDayResult> {
  const { planId, athleteId, dateParam } = params;
  const anchor = parseDateParam(dateParam.trim());
  const { gte, lte } = utcDayBounds(anchor);
  const dateKey = utcDateOnly(anchor).toISOString().slice(0, 10);

  const plan = await prisma.training_plans.findFirst({
    where: { id: planId, athleteId },
    include: {
      athlete_goal: {
        select: {
          goalTime: true,
          goalRacePace: true,
          distance: true,
        },
      },
      race_registry: {
        select: {
          raceDate: true,
          name: true,
          distanceMeters: true,
          distanceLabel: true,
        },
      },
      training_plan_preset: {
        select: { paceProfile: true },
      },
    },
  });

  if (!plan) {
    throw new MaterializeWorkoutError("Plan not found");
  }

  const race = plan.race_registry;

  const raceDistanceMiles =
    race?.distanceMeters != null && Number.isFinite(Number(race.distanceMeters))
      ? metersToMiles(Number(race.distanceMeters))
      : null;

  const catalogueTitleById = await loadCatalogueTitleByIdFromPlanSchedule(
    plan.planSchedule
  );

  const scheduled = planScheduleDayForDateKey({
    planStartDate: plan.startDate,
    planSchedule: plan.planSchedule,
    raceDate: race?.raceDate ?? null,
    raceName: race?.name ?? null,
    raceDistanceMiles,
    dateKey,
    maxWeekNumber: plan.totalWeeks,
    catalogueTitleById,
  });

  if (!scheduled) {
    throw new MaterializeWorkoutError("No scheduled workout for this date");
  }

  if (scheduled.title === "Rest") {
    throw new MaterializeWorkoutError("No scheduled workout for this date");
  }

  let existing = await prisma.workouts.findFirst({
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
    !workoutNeedsRematerialize({
      existing: { ...existing, segmentCount: existing._count.segments },
      scheduled,
    })
  ) {
    enqueuePrescriptionNarrative(existing.id, athleteId);
    return { workoutId: existing.id, status: "already_ready" };
  }

  const steps = await buildPrescriptionSteps({ scheduled, plan, race });
  assertPrescriptionSteps(steps, scheduled, dateKey);

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

  if (existing) {
    await prisma.$transaction(async (tx) => {
      await createSegmentsForWorkout({
        tx,
        workoutId: existing!.id,
        steps,
        snapshotSource: "plan_day_materialize_existing",
        scheduled,
        dateKey,
      });
    });
    enqueuePrescriptionNarrative(existing.id, athleteId);
    return { workoutId: existing.id, status: "materialized" };
  }

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
      scheduled,
      dateKey,
    });

    return w.id;
  });

  enqueuePrescriptionNarrative(workoutId, athleteId);
  return { workoutId, status: "materialized" };
}
