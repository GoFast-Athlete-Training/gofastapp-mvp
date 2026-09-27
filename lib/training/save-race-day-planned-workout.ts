/**
 * Athlete-authored race-day segments on a plan calendar day (no catalogue prescribe).
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadCatalogueTitleByIdFromPlanSchedule } from "@/lib/training/catalogue-title-map";
import {
  planScheduleDayForDateKey,
  type PlanScheduleDay,
} from "@/lib/training/plan-schedule";
import { planRaceScheduleContextFromPlan } from "@/lib/training/plan-race-schedule-context";
import { utcDateOnly } from "@/lib/training/plan-utils";
import type { WorkoutStep } from "@/lib/training/prescription";
import { ensurePlannedWorkoutPrescriptionNarrative } from "@/lib/training/prescription-narrative-service";
import { segmentSnapshotDocumentFromApiSegments } from "@/lib/training/workout-segment-snapshot";

export class RaceDayPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RaceDayPlanError";
  }
}

function parseDateParam(dateParam: string): Date {
  const s = dateParam.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new RaceDayPlanError("date must be YYYY-MM-DD");
  }
  return new Date(`${s}T12:00:00.000Z`);
}

function utcDayBounds(d: Date): { gte: Date; lte: Date } {
  const x = utcDateOnly(d);
  const gte = new Date(x);
  gte.setUTCHours(0, 0, 0, 0);
  const lte = new Date(x);
  lte.setUTCHours(23, 59, 59, 999);
  return { gte, lte };
}

function parseStepsFromBody(segments: unknown): WorkoutStep[] {
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new RaceDayPlanError("At least one segment is required");
  }
  return segments.map((seg, index) => {
    const row = seg as Record<string, unknown>;
    const title = typeof row.title === "string" ? row.title.trim() : "";
    const durationValue = Number(row.durationValue);
    if (!title) throw new RaceDayPlanError("Each segment needs a title");
    if (!Number.isFinite(durationValue) || durationValue <= 0) {
      throw new RaceDayPlanError("Each segment needs a positive distance or duration");
    }
    return {
      stepOrder: typeof row.stepOrder === "number" ? row.stepOrder : index + 1,
      title,
      durationType:
        row.durationType === "TIME" ? ("TIME" as const) : ("DISTANCE" as const),
      durationValue,
      targets: Array.isArray(row.targets) ? (row.targets as WorkoutStep["targets"]) : undefined,
      repeatCount:
        row.repeatCount != null && Number.isFinite(Number(row.repeatCount))
          ? Number(row.repeatCount)
          : undefined,
    };
  });
}

function estimatedMetersFromSteps(steps: WorkoutStep[]): number {
  let miles = 0;
  for (const s of steps) {
    if (s.durationType !== "DISTANCE") continue;
    const reps = s.repeatCount != null && s.repeatCount > 0 ? s.repeatCount : 1;
    miles += s.durationValue * reps;
  }
  return Math.round(miles * 1609.34);
}

async function loadScheduledRaceDay(params: {
  athleteId: string;
  planId: string;
  dateParam: string;
}): Promise<{ scheduled: PlanScheduleDay; dateKey: string; gte: Date; lte: Date }> {
  const anchor = parseDateParam(params.dateParam);
  const dateKey = utcDateOnly(anchor).toISOString().slice(0, 10);
  const { gte, lte } = utcDayBounds(anchor);

  const plan = await prisma.training_plans.findFirst({
    where: { id: params.planId, athleteId: params.athleteId },
    include: {
      athlete_race: {
        select: {
          raceDate: true,
          name: true,
          distanceMeters: true,
          distanceLabel: true,
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
    },
  });
  if (!plan) throw new RaceDayPlanError("Plan not found");

  const raceCtx = planRaceScheduleContextFromPlan(plan);

  const catalogueTitleById = await loadCatalogueTitleByIdFromPlanSchedule(plan.planSchedule);

  const scheduled = planScheduleDayForDateKey({
    planStartDate: plan.startDate,
    planSchedule: plan.planSchedule,
    raceDate: raceCtx.raceDate,
    raceName: raceCtx.raceName,
    raceDistanceMiles: raceCtx.raceDistanceMiles,
    dateKey,
    maxWeekNumber: plan.totalWeeks,
    catalogueTitleById,
  });

  if (!scheduled || scheduled.workoutType !== "Race") {
    throw new RaceDayPlanError("This plan day is not a race day");
  }

  return { scheduled, dateKey, gte, lte };
}

export async function getRaceDayPlanState(params: {
  athleteId: string;
  planId: string;
  dateParam: string;
}): Promise<{
  scheduled: PlanScheduleDay;
  plannedWorkoutId: string | null;
  segments: Awaited<
    ReturnType<typeof prisma.planned_workout_segments.findMany>
  >;
}> {
  const { scheduled, gte, lte } = await loadScheduledRaceDay(params);

  const existing = await prisma.planned_workouts.findFirst({
    where: {
      planId: params.planId,
      athleteId: params.athleteId,
      date: { gte, lte },
    },
    select: { id: true },
  });

  if (!existing) {
    return { scheduled, plannedWorkoutId: null, segments: [] };
  }

  const segments = await prisma.planned_workout_segments.findMany({
    where: { plannedWorkoutId: existing.id },
    orderBy: { stepOrder: "asc" },
  });

  return { scheduled, plannedWorkoutId: existing.id, segments };
}

export async function upsertRaceDayPlannedWorkout(params: {
  athleteId: string;
  planId: string;
  dateParam: string;
  title: string;
  segments: unknown;
}): Promise<{ plannedWorkoutId: string }> {
  const title = params.title?.trim();
  if (!title) throw new RaceDayPlanError("Title is required");

  const steps = parseStepsFromBody(params.segments);
  const { scheduled, gte, lte } = await loadScheduledRaceDay(params);
  const estMeters = estimatedMetersFromSteps(steps);

  const existing = await prisma.planned_workouts.findFirst({
    where: {
      planId: params.planId,
      athleteId: params.athleteId,
      date: { gte, lte },
    },
    select: { id: true, workoutPushed: true },
  });

  const plannedWorkoutId = await prisma.$transaction(async (tx) => {
    let pwId: string;
    if (existing) {
      pwId = existing.id;
      await tx.planned_workout_segments.deleteMany({ where: { plannedWorkoutId: pwId } });
      await tx.planned_workouts.update({
        where: { id: pwId },
        data: {
          title,
          workoutType: "Race",
          catalogueWorkoutId: null,
          estimatedDistanceInMeters: estMeters,
          weekNumber: scheduled.weekNumber,
          dayAssigned: scheduled.dayAssigned,
          nOffset: scheduled.nOffset,
          planCycleIndex: scheduled.planCycleIndex,
          updatedAt: new Date(),
          ...(existing.workoutPushed ? { workoutEditedAfterPush: true } : {}),
        },
      });
    } else {
      const pw = await tx.planned_workouts.create({
        data: {
          title,
          workoutType: "Race",
          athleteId: params.athleteId,
          planId: params.planId,
          date: scheduled.date,
          estimatedDistanceInMeters: estMeters,
          catalogueWorkoutId: null,
          weekNumber: scheduled.weekNumber,
          dayAssigned: scheduled.dayAssigned,
          nOffset: scheduled.nOffset,
          planCycleIndex: scheduled.planCycleIndex,
          updatedAt: new Date(),
        },
      });
      pwId = pw.id;
    }

    const segmentRows: Prisma.planned_workout_segmentsCreateManyInput[] = steps.map((s) => ({
      plannedWorkoutId: pwId,
      stepOrder: s.stepOrder,
      title: s.title,
      durationType: s.durationType,
      durationValue: s.durationValue,
      targets: s.targets as object | undefined,
      repeatCount: s.repeatCount ?? undefined,
      paceTargetEncodingVersion: 2,
      updatedAt: new Date(),
    }));
    await tx.planned_workout_segments.createMany({ data: segmentRows });
    await tx.planned_workouts.update({
      where: { id: pwId },
      data: {
        segmentSnapshotJson: segmentSnapshotDocumentFromApiSegments(
          steps,
          "race_day_builder"
        ),
        updatedAt: new Date(),
      },
    });
    return pwId;
  });

  void ensurePlannedWorkoutPrescriptionNarrative({
    plannedWorkoutId,
    athleteId: params.athleteId,
  }).catch((e) => console.warn("ensurePlannedWorkoutPrescriptionNarrative:", e));

  return { plannedWorkoutId };
}
