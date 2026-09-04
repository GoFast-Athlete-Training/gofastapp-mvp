import { prisma } from "@/lib/prisma";
import { TrainingPlanLifecycle } from "@prisma/client";
import { pushWorkoutToGarminForAthlete } from "@/lib/garmin-workouts/push-workout-for-athlete";
import { ymdFromDate } from "@/lib/training/plan-utils";

export type GarminPlanWorkoutPushResult = {
  workoutId: string;
  athleteId: string;
  ok: boolean;
  skipped?: boolean;
  action?: string;
  error?: string;
  scheduledDate?: string;
};

export type PushPlanWorkoutsBatchSummary = {
  candidateCount: number;
  scheduled: number;
  updated: number;
  skipped: number;
  failed: number;
};

export type PushPlanWorkoutsBatchOptions = {
  dateStart: Date;
  dateEnd: Date;
  candidateLimit?: number;
  runLabel: string;
  /** Daily cron / post-generate: only rows the stack has not pushed yet. */
  unsentOnly?: boolean;
  athleteIds?: string[];
};

export type BatchPushCandidate = {
  id: string;
  athleteId: string | null;
  planId: string | null;
  date: Date | null;
  workoutPushed: boolean;
};

function batchCandidateGroupKey(w: BatchPushCandidate): string | null {
  if (!w.athleteId || !w.planId || !w.date) return null;
  return `${w.athleteId}|${w.planId}|${ymdFromDate(w.date)}`;
}

function batchCandidateRank(w: BatchPushCandidate): number {
  return w.workoutPushed ? 2 : 1;
}

/** One canonical row per athlete + plan + scheduled date; duplicates are skipped. */
export function dedupeBatchPushCandidates<T extends BatchPushCandidate>(
  candidates: T[]
): { toPush: T[]; duplicateSkips: T[] } {
  const byKey = new Map<string, T[]>();
  const withoutKey: T[] = [];

  for (const w of candidates) {
    const key = batchCandidateGroupKey(w);
    if (!key) {
      withoutKey.push(w);
      continue;
    }
    const list = byKey.get(key) ?? [];
    list.push(w);
    byKey.set(key, list);
  }

  const toPush: T[] = [...withoutKey];
  const duplicateSkips: T[] = [];

  for (const group of byKey.values()) {
    const sorted = [...group].sort(
      (a, b) =>
        batchCandidateRank(b) - batchCandidateRank(a) || a.id.localeCompare(b.id)
    );
    toPush.push(sorted[0]!);
    duplicateSkips.push(...sorted.slice(1));
  }

  return { toPush, duplicateSkips };
}

/** Exported for unit tests. */
export function shouldPushBatchCandidate(workoutPushed: boolean): boolean {
  return !workoutPushed;
}

/**
 * Push materialized plan workouts in a date range to Garmin Training Calendar.
 * Skips rows where workoutPushed is already true (stack already acted).
 */
export async function pushPlanWorkoutsInDateRange(
  options: PushPlanWorkoutsBatchOptions
): Promise<{
  results: GarminPlanWorkoutPushResult[];
  summary: PushPlanWorkoutsBatchSummary;
}> {
  const {
    dateStart,
    dateEnd,
    candidateLimit = 40,
    runLabel,
    unsentOnly = false,
    athleteIds,
  } = options;

  console.info(`[${runLabel}] batch start`, {
    dateStart: dateStart.toISOString(),
    dateEnd: dateEnd.toISOString(),
    candidateLimit,
    unsentOnly,
    athleteFilterCount: athleteIds?.length ?? null,
  });

  const candidates = await prisma.planned_workouts.findMany({
    where: {
      date: { gte: dateStart, lte: dateEnd },
      ...(unsentOnly ? { workoutPushed: false } : {}),
      training_plans: {
        lifecycleStatus: TrainingPlanLifecycle.ACTIVE,
      },
      Athlete: {
        garmin_access_token: { not: null },
        garmin_user_id: { not: null },
        ...(athleteIds?.length ? { id: { in: athleteIds } } : {}),
      },
    },
    select: {
      id: true,
      athleteId: true,
      planId: true,
      date: true,
      workoutPushed: true,
    },
    orderBy: [{ date: "asc" }, { id: "asc" }],
    take: candidateLimit,
  });

  const { toPush, duplicateSkips } = dedupeBatchPushCandidates(candidates);

  const results: GarminPlanWorkoutPushResult[] = [];
  let scheduled = 0;
  let updated = 0;
  let skipped = duplicateSkips.length;
  let failed = 0;

  for (const dup of duplicateSkips) {
    if (!dup.athleteId) continue;
    results.push({
      workoutId: dup.id,
      athleteId: dup.athleteId,
      ok: true,
      skipped: true,
      action: "duplicate_plan_day_skip",
      error: "Duplicate materialized row for same plan day; canonical row pushed instead.",
    });
  }

  for (const w of toPush) {
    const athleteId = w.athleteId;
    if (!athleteId) continue;

    if (!shouldPushBatchCandidate(w.workoutPushed)) {
      skipped++;
      results.push({
        workoutId: w.id,
        athleteId,
        ok: true,
        skipped: true,
        action: "already_pushed_skip",
        error: "Stack already pushed this plan day.",
      });
      continue;
    }

    const segCount = await prisma.planned_workout_segments.count({
      where: { plannedWorkoutId: w.id },
    });
    if (segCount === 0) {
      skipped++;
      results.push({
        workoutId: w.id,
        athleteId,
        ok: false,
        skipped: true,
        error: "no_segments_not_materialized",
      });
      continue;
    }

    const r = await pushWorkoutToGarminForAthlete(athleteId, w.id);
    if (r.ok) {
      if (r.isUpdatedResend) {
        updated++;
      } else {
        scheduled++;
      }
      results.push({
        workoutId: w.id,
        athleteId,
        ok: true,
        action: r.isUpdatedResend ? "updated_resend" : "schedule-today",
        scheduledDate: r.scheduledDate,
      });
    } else {
      failed++;
      results.push({
        workoutId: w.id,
        athleteId,
        ok: false,
        action: "schedule-today",
        error: `${r.code}: ${r.message}`,
      });
    }
  }

  const summary: PushPlanWorkoutsBatchSummary = {
    candidateCount: candidates.length,
    scheduled,
    updated,
    skipped,
    failed,
  };

  console.info(`[${runLabel}] batch complete`, summary);

  return { results, summary };
}
