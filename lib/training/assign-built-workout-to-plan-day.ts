/**
 * Replace a plan day's materialized prescribe row with athlete-built segments.
 */

import type { WorkoutType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  expandWeekSchedule,
  weekNumberFromPlanDate,
} from "@/lib/training/plan-schedule";
import type { PlanDaySchedule, PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";
import { isStructuredPlanWeek } from "@/lib/training/plan-schedule-schema";
import { loadAthletePlanContext } from "@/lib/training/plan-ingest-plan-context";
import type { WorkoutStep } from "@/lib/training/prescription";
import { upsertPlannedWorkoutFromIngestDay } from "@/lib/training/plan-ingest-planned-upsert";
import { utcDateOnly } from "@/lib/training/plan-utils";

export class AssignPlanDayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssignPlanDayError";
  }
}

function ensureStructuredSchedule(planSchedule: unknown): PlanWeekSchedule[] {
  if (!Array.isArray(planSchedule)) return [];
  const out: PlanWeekSchedule[] = [];
  for (const w of planSchedule) {
    if (isStructuredPlanWeek(w)) out.push(w);
  }
  return out.sort((a, b) => a.weekNumber - b.weekNumber);
}

function patchDayInWeek(week: PlanWeekSchedule, day: PlanDaySchedule): PlanWeekSchedule {
  const days = [...week.days];
  const idx = days.findIndex((d) => d.dow === day.dow);
  const next: PlanDaySchedule = {
    ...day,
    catalogueWorkoutId: day.catalogueWorkoutId ?? null,
    planCycleIndex: day.planCycleIndex ?? null,
  };
  if (idx >= 0) days[idx] = { ...days[idx], ...next };
  else days.push(next);
  days.sort((a, b) => a.dow - b.dow);
  return { ...week, days };
}

function spliceWeek(schedule: PlanWeekSchedule[], week: PlanWeekSchedule): PlanWeekSchedule[] {
  const copy = [...schedule];
  const idx = copy.findIndex((w) => w.weekNumber === week.weekNumber);
  if (idx >= 0) copy[idx] = week;
  else {
    copy.push(week);
    copy.sort((a, b) => a.weekNumber - b.weekNumber);
  }
  return copy;
}

function parseStepsFromBody(segments: unknown): WorkoutStep[] {
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new AssignPlanDayError("At least one segment is required");
  }
  return segments.map((seg, index) => {
    const row = seg as Record<string, unknown>;
    const title = typeof row.title === "string" ? row.title.trim() : "";
    const durationValue = Number(row.durationValue);
    if (!title) throw new AssignPlanDayError("Each segment needs a title");
    if (!Number.isFinite(durationValue) || durationValue <= 0) {
      throw new AssignPlanDayError("Each segment needs a positive distance or duration");
    }
    return {
      stepOrder: typeof row.stepOrder === "number" ? row.stepOrder : index + 1,
      title,
      durationType: row.durationType === "TIME" ? ("TIME" as const) : ("DISTANCE" as const),
      durationValue,
      targets: Array.isArray(row.targets) ? (row.targets as WorkoutStep["targets"]) : undefined,
      repeatCount:
        row.repeatCount != null && Number.isFinite(Number(row.repeatCount))
          ? Number(row.repeatCount)
          : undefined,
      recoveryDurationType:
        row.recoveryDurationType === "TIME" || row.recoveryDurationType === "DISTANCE"
          ? row.recoveryDurationType
          : null,
      recoveryDurationValue:
        row.recoveryDurationValue != null && Number.isFinite(Number(row.recoveryDurationValue))
          ? Number(row.recoveryDurationValue)
          : null,
    };
  });
}

function totalMilesFromSteps(steps: WorkoutStep[]): number {
  let mi = 0;
  for (const s of steps) {
    if (s.durationType !== "DISTANCE") continue;
    const reps = s.repeatCount != null && s.repeatCount > 1 ? s.repeatCount : 1;
    mi += s.durationValue * reps;
    if (
      s.recoveryDurationType === "DISTANCE" &&
      s.recoveryDurationValue != null &&
      s.recoveryDurationValue > 0 &&
      reps > 1
    ) {
      mi += s.recoveryDurationValue * (reps - 1);
    }
  }
  return Math.round(mi * 100) / 100;
}

export async function assignBuiltWorkoutToPlanDay(params: {
  athleteId: string;
  planId: string;
  dateKey: string;
  title: string;
  workoutType: WorkoutType | string;
  segments: unknown;
}): Promise<{ plannedWorkoutId: string }> {
  const dateKey = params.dateKey.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new AssignPlanDayError("dateKey must be YYYY-MM-DD");
  }

  const steps = parseStepsFromBody(params.segments);
  const anchor = new Date(`${dateKey}T12:00:00.000Z`);
  const gte = new Date(anchor);
  gte.setUTCHours(0, 0, 0, 0);
  const lte = new Date(anchor);
  lte.setUTCHours(23, 59, 59, 999);

  const existingPw = await prisma.planned_workouts.findFirst({
    where: {
      planId: params.planId,
      athleteId: params.athleteId,
      date: { gte, lte },
    },
    select: { id: true, workoutCompleted: true, workoutId: true },
  });
  if (existingPw?.workoutCompleted) {
    throw new AssignPlanDayError("This plan day is already logged — cannot replace it.");
  }

  const planCtx = await loadAthletePlanContext(params.planId, params.athleteId);
  if (!planCtx) {
    throw new AssignPlanDayError("Plan not found");
  }

  const weekNumber = weekNumberFromPlanDate(planCtx.startDate, utcDateOnly(anchor));
  const weeks = ensureStructuredSchedule(planCtx.planSchedule);
  let week = weeks.find((w) => w.weekNumber === weekNumber);
  if (!week) {
    week = { weekNumber, days: [] };
  }

  const miles = totalMilesFromSteps(steps);
  const wt = String(params.workoutType).trim() || "Easy";
  const daySlot: PlanDaySchedule = {
    dow: (() => {
      const js = anchor.getUTCDay();
      return js === 0 ? 7 : js;
    })(),
    workoutType: wt as PlanDaySchedule["workoutType"],
    miles: miles > 0 ? miles : 1,
    catalogueWorkoutId: null,
    planCycleIndex: null,
  };

  const patchedWeek = patchDayInWeek(week, daySlot);
  const nextSchedule = spliceWeek(weeks, patchedWeek);
  await prisma.training_plans.update({
    where: { id: params.planId },
    data: {
      planSchedule: nextSchedule as unknown as Prisma.InputJsonValue,
      updatedAt: new Date(),
    },
  });
  planCtx.planSchedule = nextSchedule;

  const expandedDays = expandWeekSchedule({
    planStartDate: planCtx.startDate,
    planSchedule: planCtx.planSchedule,
    weekNumber,
    raceDate: planCtx.raceCtx.raceDate,
    raceName: planCtx.raceCtx.raceName,
    raceDistanceMiles: planCtx.raceCtx.raceDistanceMiles,
    totalWeeks: planCtx.totalWeeks,
  });
  const expanded = expandedDays.find((d) => d.dateKey === dateKey);
  if (!expanded) {
    throw new AssignPlanDayError("Could not resolve plan day for this date");
  }

  const title = params.title.trim() || expanded.title;
  const plannedWorkoutId = await upsertPlannedWorkoutFromIngestDay({
    athleteId: params.athleteId,
    planId: params.planId,
    day: expanded,
    title,
    segments: steps,
  });

  return { plannedWorkoutId };
}
