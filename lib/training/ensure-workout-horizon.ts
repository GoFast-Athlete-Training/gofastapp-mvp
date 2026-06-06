/**
 * User-triggered rolling materialization: ensure the next N calendar days of plan
 * workouts exist as Garmin-ready `workouts` rows with segments.
 */

import { TrainingPlanLifecycle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addDaysUtc, localTodayKey, utcDateOnly, ymdFromDate } from "./plan-utils";
import { planScheduleDayForDateKey } from "./plan-schedule";
import { metersToMiles } from "@/lib/pace-utils";
import {
  MaterializeWorkoutError,
  materializeWorkoutForPlanDay,
} from "./workout-materializer";

export type HorizonDayResult =
  | { dateKey: string; status: "already_ready"; workoutId: string }
  | { dateKey: string; status: "materialized"; workoutId: string }
  | { dateKey: string; status: "skipped_no_session" }
  | { dateKey: string; status: "error"; message: string };

export type EnsureWorkoutHorizonResult = {
  planId: string | null;
  startDateKey: string;
  daysRequested: number;
  summary: {
    alreadyReady: number;
    materialized: number;
    skippedNoSession: number;
    errors: number;
  };
  /** True when at least one day was newly materialized or repaired. */
  changed: boolean;
  days: HorizonDayResult[];
};

const DEFAULT_HORIZON_DAYS = 14;
const MAX_HORIZON_DAYS = 21;

export function clampHorizonDays(days: number | undefined): number {
  return Math.min(Math.max(Math.trunc(days ?? DEFAULT_HORIZON_DAYS), 1), MAX_HORIZON_DAYS);
}

export function horizonDateKeyFromOffset(startDateKey: string, offsetDays: number): string {
  const anchor = utcDateOnly(new Date(`${startDateKey}T12:00:00.000Z`));
  return ymdFromDate(addDaysUtc(anchor, offsetDays));
}

export function isRunnablePlanDay(scheduled: {
  workoutType: string;
  title: string;
} | null): scheduled is { workoutType: string; title: string } {
  if (!scheduled) return false;
  if (scheduled.title === "Rest") return false;
  return true;
}

function isValidDateKey(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export async function ensureWorkoutHorizonForAthlete(params: {
  athleteId: string;
  days?: number;
  /** Client-local calendar day; defaults to server local today. */
  startDateKey?: string;
}): Promise<EnsureWorkoutHorizonResult> {
  const daysRequested = clampHorizonDays(params.days);
  const startDateKey = isValidDateKey(params.startDateKey?.trim())
    ? params.startDateKey!.trim()
    : localTodayKey();

  const plan = await prisma.training_plans.findFirst({
    where: {
      athleteId: params.athleteId,
      lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
    },
    orderBy: { updatedAt: "desc" },
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

  if (!plan || !Array.isArray(plan.planSchedule) || plan.planSchedule.length === 0) {
    return {
      planId: null,
      startDateKey,
      daysRequested,
      summary: {
        alreadyReady: 0,
        materialized: 0,
        skippedNoSession: daysRequested,
        errors: 0,
      },
      changed: false,
      days: Array.from({ length: daysRequested }, (_, i) => ({
        dateKey: horizonDateKeyFromOffset(startDateKey, i),
        status: "skipped_no_session" as const,
      })),
    };
  }

  const race = plan.race_registry;
  const raceDistanceMiles =
    race?.distanceMeters != null && Number.isFinite(Number(race.distanceMeters))
      ? metersToMiles(Number(race.distanceMeters))
      : null;

  const days: HorizonDayResult[] = [];
  let alreadyReady = 0;
  let materialized = 0;
  let skippedNoSession = 0;
  let errors = 0;

  for (let offset = 0; offset < daysRequested; offset++) {
    const dateKey = horizonDateKeyFromOffset(startDateKey, offset);

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

    if (!isRunnablePlanDay(scheduled)) {
      days.push({ dateKey, status: "skipped_no_session" });
      skippedNoSession++;
      continue;
    }

    try {
      const result = await materializeWorkoutForPlanDay({
        planId: plan.id,
        athleteId: params.athleteId,
        dateParam: dateKey,
      });
      if (result.status === "already_ready") {
        days.push({ dateKey, status: "already_ready", workoutId: result.workoutId });
        alreadyReady++;
      } else {
        days.push({ dateKey, status: "materialized", workoutId: result.workoutId });
        materialized++;
      }
    } catch (e) {
      const message =
        e instanceof MaterializeWorkoutError
          ? e.message
          : e instanceof Error
            ? e.message
            : "materialize failed";
      days.push({ dateKey, status: "error", message });
      errors++;
    }
  }

  return {
    planId: plan.id,
    startDateKey,
    daysRequested,
    summary: {
      alreadyReady,
      materialized,
      skippedNoSession,
      errors,
    },
    changed: materialized > 0,
    days,
  };
}
