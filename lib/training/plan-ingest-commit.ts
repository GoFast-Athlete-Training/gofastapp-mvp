/**
 * Commit scoped plan ingest previews onto planSchedule + planned_workouts.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { PlanIngestPreviewResult } from "@/lib/training/plan-ingest-contract";
import type { PlanDaySchedule, PlanWeekSchedule } from "@/lib/training/plan-schedule-schema";
import { isStructuredPlanWeek } from "@/lib/training/plan-schedule-schema";
import {
  expandWeekSchedule,
  weekBoundsFromPlan,
  weekNumberFromPlanDate,
} from "@/lib/training/plan-schedule";
import {
  loadAthletePlanContext,
  type AthletePlanContext,
} from "@/lib/training/plan-ingest-plan-context";
import {
  materializeWorkoutForPlanDay,
  MaterializeWorkoutError,
} from "@/lib/training/workout-materializer";
import {
  replacePrescribeSegmentsForAthlete,
  type PrescribeSegmentInput,
} from "@/lib/training/workout-or-planned-resolve";
import { cleanupFuturePlanWorkoutsAfterRegenerate } from "@/lib/training/plan-regenerate-cleanup";
import { productTodayKey } from "@/lib/plan-calendar-day";
import { dateKeyToUtcNoonDate } from "@/lib/calendar-date";
import { utcDateOnly, ymdFromDate } from "@/lib/training/plan-utils";
import type { WorkoutStep } from "@/lib/training/prescription";
import { buildScheduleNativeWorkoutSteps } from "@/lib/training/schedule-native-workout-steps";
import { applyWeekIngestGuard, dateKeyForWeekDay } from "@/lib/training/plan-week-ingest-guard";
import { upsertPlannedWorkoutFromIngestDay } from "@/lib/training/plan-ingest-planned-upsert";
import { planWeekPhaseForNumber } from "@/lib/training/plan-week-phase-key";
import { WorkoutType as WT } from "@prisma/client";

function workoutStepsToPrescribeInput(steps: WorkoutStep[]): PrescribeSegmentInput[] {
  return steps.map((s, i) => ({
    stepOrder: s.stepOrder ?? i + 1,
    title: s.title,
    durationType: s.durationType === "TIME" ? "TIME" : "DISTANCE",
    durationValue: s.durationValue,
    targets: (s.targets ?? null) as Prisma.InputJsonValue | null,
    repeatCount: s.repeatCount ?? null,
    notes: null,
    recoveryDurationType: s.recoveryDurationType ?? null,
    recoveryDurationValue: s.recoveryDurationValue ?? null,
  }));
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

async function persistPlanSchedule(planId: string, weeks: PlanWeekSchedule[]): Promise<void> {
  await prisma.training_plans.update({
    where: { id: planId },
    data: {
      planSchedule: weeks as unknown as Prisma.InputJsonValue,
      updatedAt: new Date(),
    },
  });
}

async function clearPlannedWorkoutsInDateRange(params: {
  planId: string;
  athleteId: string;
  fromDateInclusive: Date;
  toDateInclusive: Date;
  excludeDateKeys?: Set<string>;
}): Promise<number> {
  const planned = await prisma.planned_workouts.findMany({
    where: {
      planId: params.planId,
      athleteId: params.athleteId,
      date: { gte: params.fromDateInclusive, lte: params.toDateInclusive },
    },
    select: { id: true, date: true },
  });
  if (planned.length === 0) return 0;
  const ids = planned
    .filter((p) => {
      if (!params.excludeDateKeys?.size) return true;
      const key = ymdFromDate(utcDateOnly(p.date));
      return !params.excludeDateKeys.has(key);
    })
    .map((p) => p.id);
  if (ids.length === 0) return 0;
  await prisma.$transaction(async (tx) => {
    await tx.planned_workout_segments.deleteMany({ where: { plannedWorkoutId: { in: ids } } });
    await tx.planned_workouts.deleteMany({ where: { id: { in: ids } } });
  });
  return ids.length;
}

function buildDayTitlesByDateKey(preview: PlanIngestPreviewResult): Record<string, string> {
  if (preview.scope === "plan") {
    return preview.dayTitlesByDateKey ?? {};
  }
  if (preview.scope !== "week") return {};
  const out: Record<string, string> = {};
  for (const row of preview.weekIngestRows ?? []) {
    if (row.status === "import" && row.workoutName.trim()) {
      out[row.dateKey] = row.workoutName.trim();
    }
  }
  for (const d of preview.weekPreviewDays ?? []) {
    if (d.action === "replace" && d.workoutName?.trim()) {
      out[d.dateKey] = d.workoutName.trim();
    }
  }
  return out;
}

async function applyPlannedWorkoutTitleOverride(params: {
  athleteId: string;
  planId: string;
  dateKey: string;
  title: string;
}): Promise<void> {
  const day = utcDateOnly(new Date(`${params.dateKey}T12:00:00.000Z`));
  const gte = new Date(day);
  gte.setUTCHours(0, 0, 0, 0);
  const lte = new Date(day);
  lte.setUTCHours(23, 59, 59, 999);
  await prisma.planned_workouts.updateMany({
    where: {
      athleteId: params.athleteId,
      planId: params.planId,
      date: { gte, lte },
    },
    data: { title: params.title, updatedAt: new Date() },
  });
}

async function rematerializeFutureDaysInWeek(params: {
  plan: AthletePlanContext;
  weekNumber: number;
  protectedDateKeys?: Set<string>;
  daySegmentsByDateKey?: Record<string, WorkoutStep[]>;
  dayTitlesByDateKey?: Record<string, string>;
}): Promise<{ materialized: number; errors: string[] }> {
  const todayUtc = dateKeyToUtcNoonDate(productTodayKey());
  const bounds = weekBoundsFromPlan(params.plan.startDate, params.weekNumber, {
    raceDate: params.plan.raceCtx.raceDate,
    totalWeeks: params.plan.totalWeeks,
  });

  const days = expandWeekSchedule({
    planStartDate: params.plan.startDate,
    planSchedule: params.plan.planSchedule,
    weekNumber: params.weekNumber,
    raceDate: params.plan.raceCtx.raceDate,
    raceName: params.plan.raceCtx.raceName,
    raceDistanceMiles: params.plan.raceCtx.raceDistanceMiles,
    totalWeeks: params.plan.totalWeeks,
  });

  let materialized = 0;
  const errors: string[] = [];

  for (const d of days) {
    const dayDate = utcDateOnly(d.date);
    if (dayDate.getTime() < todayUtc.getTime()) continue;
    if (params.protectedDateKeys?.has(d.dateKey)) continue;
    if (d.title === "Rest") continue;
    if (d.workoutType === WT.Race) continue;

    const ingestSegments = params.daySegmentsByDateKey?.[d.dateKey];

    if (ingestSegments?.length) {
      try {
        const title = params.dayTitlesByDateKey?.[d.dateKey]?.trim() || d.title;
        await upsertPlannedWorkoutFromIngestDay({
          athleteId: params.plan.athleteId,
          planId: params.plan.id,
          day: d,
          title,
          segments: ingestSegments,
        });
        materialized += 1;
      } catch (e) {
        errors.push(`${d.dateKey}: ${e instanceof Error ? e.message : String(e)}`);
      }
      continue;
    }

    if (d.catalogueWorkoutId) {
      try {
        await materializeWorkoutForPlanDay({
          athleteId: params.plan.athleteId,
          planId: params.plan.id,
          dateParam: d.dateKey,
        });
        materialized += 1;
      } catch (e) {
        const msg = e instanceof MaterializeWorkoutError ? e.message : String(e);
        errors.push(`${d.dateKey}: ${msg}`);
      }
      continue;
    }

    const nativeSteps = buildScheduleNativeWorkoutSteps({
      workoutType: d.workoutType,
      miles: d.estimatedDistanceInMeters / 1609.34,
      fiveKPace: params.plan.currentFiveKPace,
    });
    if (nativeSteps.length > 0) {
      try {
        const title = params.dayTitlesByDateKey?.[d.dateKey]?.trim() || d.title;
        await upsertPlannedWorkoutFromIngestDay({
          athleteId: params.plan.athleteId,
          planId: params.plan.id,
          day: d,
          title,
          segments: nativeSteps,
        });
        materialized += 1;
      } catch (e) {
        errors.push(`${d.dateKey}: ${e instanceof Error ? e.message : String(e)}`);
      }
      continue;
    }

    errors.push(`${d.dateKey}: could not build workout from schedule`);
  }

  return { materialized, errors };
}

async function commitWorkoutIngest(params: {
  plan: AthletePlanContext;
  preview: Extract<PlanIngestPreviewResult, { scope: "workout" }>;
}): Promise<{ plannedWorkoutId: string | null; warnings: string[] }> {
  const { workout } = params.preview;
  const weekNumber = weekNumberFromPlanDate(
    params.plan.startDate,
    utcDateOnly(new Date(`${workout.dateKey}T12:00:00.000Z`))
  );

  const weeks = ensureStructuredSchedule(params.plan.planSchedule);
  let week = weeks.find((w) => w.weekNumber === weekNumber);
  if (!week) {
    week = { weekNumber, days: [] };
  }

  const hasParsedSegments = (workout.segments?.length ?? 0) > 0;

  const daySlot: PlanDaySchedule = {
    dow: (() => {
      const d = new Date(`${workout.dateKey}T12:00:00.000Z`);
      const js = d.getUTCDay();
      return js === 0 ? 7 : js;
    })(),
    workoutType: workout.workoutType,
    miles: workout.miles,
    catalogueWorkoutId: hasParsedSegments ? null : (workout.catalogueWorkoutId ?? null),
    planCycleIndex: workout.planCycleIndex ?? null,
  };

  const patchedWeek = patchDayInWeek(week, daySlot);
  const nextSchedule = spliceWeek(weeks, patchedWeek);
  await persistPlanSchedule(params.plan.id, nextSchedule);
  params.plan.planSchedule = nextSchedule;

  const warnings: string[] = [];
  let plannedWorkoutId: string | null = null;

  const titleOverride =
    workout.suggestedTitle?.trim() ||
    params.preview.summary.split("·")[0]?.trim() ||
    undefined;

  if (hasParsedSegments && workout.segments) {
    const days = expandWeekSchedule({
      planStartDate: params.plan.startDate,
      planSchedule: params.plan.planSchedule,
      weekNumber,
      raceDate: params.plan.raceCtx.raceDate,
      raceName: params.plan.raceCtx.raceName,
      raceDistanceMiles: params.plan.raceCtx.raceDistanceMiles,
      totalWeeks: params.plan.totalWeeks,
    });
    const expanded = days.find((d) => d.dateKey === workout.dateKey);
    if (!expanded) {
      warnings.push("Could not expand plan day for ingest");
      return { plannedWorkoutId: null, warnings };
    }
    try {
      plannedWorkoutId = await upsertPlannedWorkoutFromIngestDay({
        athleteId: params.plan.athleteId,
        planId: params.plan.id,
        day: expanded,
        title: titleOverride || expanded.title,
        segments: workout.segments,
      });
    } catch (e) {
      warnings.push(e instanceof Error ? e.message : String(e));
    }
    return { plannedWorkoutId, warnings };
  }

  const nativeSteps = buildScheduleNativeWorkoutSteps({
    workoutType: workout.workoutType,
    miles: workout.miles,
    fiveKPace: params.plan.currentFiveKPace,
  });
  if (nativeSteps.length > 0) {
    const days = expandWeekSchedule({
      planStartDate: params.plan.startDate,
      planSchedule: params.plan.planSchedule,
      weekNumber,
      raceDate: params.plan.raceCtx.raceDate,
      raceName: params.plan.raceCtx.raceName,
      raceDistanceMiles: params.plan.raceCtx.raceDistanceMiles,
      totalWeeks: params.plan.totalWeeks,
    });
    const expanded = days.find((d) => d.dateKey === workout.dateKey);
    if (expanded) {
      try {
        plannedWorkoutId = await upsertPlannedWorkoutFromIngestDay({
          athleteId: params.plan.athleteId,
          planId: params.plan.id,
          day: expanded,
          title: titleOverride || expanded.title,
          segments: nativeSteps,
        });
      } catch (e) {
        warnings.push(e instanceof Error ? e.message : String(e));
      }
    } else {
      warnings.push("Could not expand plan day for schedule-native workout");
    }
    return { plannedWorkoutId, warnings };
  }

  try {
    const mat = await materializeWorkoutForPlanDay({
      athleteId: params.plan.athleteId,
      planId: params.plan.id,
      dateParam: workout.dateKey,
    });
    plannedWorkoutId = mat.plannedWorkoutId;
  } catch (e) {
    warnings.push(e instanceof MaterializeWorkoutError ? e.message : String(e));
  }

  if (titleOverride && plannedWorkoutId) {
    await applyPlannedWorkoutTitleOverride({
      athleteId: params.plan.athleteId,
      planId: params.plan.id,
      dateKey: workout.dateKey,
      title: titleOverride,
    });
  }

  return { plannedWorkoutId, warnings };
}

async function commitWeekIngest(params: {
  plan: AthletePlanContext;
  preview: Extract<PlanIngestPreviewResult, { scope: "week" }>;
}): Promise<{ clearedPlanned: number; materialized: number; errors: string[] }> {
  const weekNumber = params.preview.week.weekNumber;
  const { week, protectedDateKeys } = await applyWeekIngestGuard({
    plan: params.plan,
    weekNumber,
    incomingWeek: params.preview.week.week,
  });

  const weeks = ensureStructuredSchedule(params.plan.planSchedule);
  const existingWeek = weeks.find((w) => w.weekNumber === weekNumber);
  const segmentDateKeys = new Set(
    Object.keys(params.preview.daySegmentsByDateKey ?? {}),
  );
  const phasedWeek = {
    ...week,
    weekNumber,
    phase: existingWeek?.phase ?? planWeekPhaseForNumber(params.plan.totalWeeks, weekNumber),
    days: week.days.map((day) => {
      const dk = dateKeyForWeekDay(params.plan.startDate, weekNumber, day.dow);
      if (!segmentDateKeys.has(dk)) return day;
      return { ...day, catalogueWorkoutId: null, planCycleIndex: null };
    }),
  };
  const nextSchedule = spliceWeek(weeks, phasedWeek);
  await persistPlanSchedule(params.plan.id, nextSchedule);
  params.plan.planSchedule = nextSchedule;

  const todayUtc = dateKeyToUtcNoonDate(productTodayKey());
  const bounds = weekBoundsFromPlan(params.plan.startDate, weekNumber, {
    raceDate: params.plan.raceCtx.raceDate,
    totalWeeks: params.plan.totalWeeks,
  });
  const from =
    bounds.weekStart.getTime() < todayUtc.getTime() ? todayUtc : bounds.weekStart;

  const clearedPlanned = await clearPlannedWorkoutsInDateRange({
    planId: params.plan.id,
    athleteId: params.plan.athleteId,
    fromDateInclusive: from,
    toDateInclusive: bounds.weekEnd,
    excludeDateKeys: protectedDateKeys,
  });

  const dayTitlesByDateKey = buildDayTitlesByDateKey(params.preview);

  const { materialized, errors } = await rematerializeFutureDaysInWeek({
    plan: params.plan,
    weekNumber,
    protectedDateKeys,
    dayTitlesByDateKey,
    daySegmentsByDateKey: params.preview.daySegmentsByDateKey,
  });

  return { clearedPlanned, materialized, errors };
}

async function commitPlanIngestScope(params: {
  plan: AthletePlanContext;
  preview: Extract<PlanIngestPreviewResult, { scope: "plan" }>;
}): Promise<{ replacedWeeks: number; cleanup: Awaited<ReturnType<typeof cleanupFuturePlanWorkoutsAfterRegenerate>> }> {
  const todayKey = productTodayKey();
  const currentWeek = weekNumberFromPlanDate(
    params.plan.startDate,
    utcDateOnly(new Date(`${todayKey}T12:00:00.000Z`))
  );

  const existing = ensureStructuredSchedule(params.plan.planSchedule);
  const incoming = params.preview.plan.weeks.filter((w) => w.weekNumber >= currentWeek);

  const segmentDateKeys = new Set(
    Object.keys(params.preview.daySegmentsByDateKey ?? {}),
  );

  let next = [...existing.filter((w) => w.weekNumber < currentWeek)];
  for (const w of incoming) {
    const wn = w.weekNumber;
    const phased = {
      ...w,
      phase:
        w.phase ??
        planWeekPhaseForNumber(params.plan.totalWeeks, wn),
      days: w.days.map((day) => {
        const dk = dateKeyForWeekDay(params.plan.startDate, wn, day.dow);
        if (!segmentDateKeys.has(dk)) return day;
        return { ...day, catalogueWorkoutId: null, planCycleIndex: null };
      }),
    };
    next = spliceWeek(next, phased);
  }

  await persistPlanSchedule(params.plan.id, next);
  params.plan.planSchedule = next;

  const cleanup = await cleanupFuturePlanWorkoutsAfterRegenerate({
    planId: params.plan.id,
    athleteId: params.plan.athleteId,
  });

  const dayTitlesByDateKey = buildDayTitlesByDateKey(params.preview);

  for (const w of incoming) {
    await rematerializeFutureDaysInWeek({
      plan: params.plan,
      weekNumber: w.weekNumber,
      dayTitlesByDateKey,
      daySegmentsByDateKey: params.preview.daySegmentsByDateKey,
    });
  }

  return { replacedWeeks: incoming.length, cleanup };
}

export async function commitPlanIngest(params: {
  athleteId: string;
  planId: string;
  preview: PlanIngestPreviewResult;
}): Promise<
  | { ok: true; result: Record<string, unknown> }
  | { ok: false; error: string }
> {
  const plan = await loadAthletePlanContext(params.planId, params.athleteId);
  if (!plan) return { ok: false, error: "Plan not found" };

  if (params.preview.scope === "workout") {
    const r = await commitWorkoutIngest({ plan, preview: params.preview });
    return { ok: true, result: r };
  }
  if (params.preview.scope === "week") {
    const r = await commitWeekIngest({ plan, preview: params.preview });
    if (r.errors.length > 0) {
      return {
        ok: false,
        error: `Week saved but ${r.errors.length} day(s) failed to regenerate: ${r.errors.join("; ")}`,
      };
    }
    return { ok: true, result: r };
  }
  const r = await commitPlanIngestScope({ plan, preview: params.preview });
  return { ok: true, result: r };
}
