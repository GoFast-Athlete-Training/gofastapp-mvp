import { prisma } from "@/lib/prisma";
import { pushWorkoutToGarminForAthlete } from "@/lib/garmin-workouts/push-workout-for-athlete";
import type { GarminPushMode } from "@/lib/garmin-workouts/garmin-calendar-state";
import { ymdFromDate } from "@/lib/training/plan-utils";

export type GarminPlanWorkoutPushResult = {
  workoutId: string;
  athleteId: string;
  ok: boolean;
  skipped?: boolean;
  action?: string;
  error?: string;
  scheduledDate?: string;
  garminScheduleId?: number | null;
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
  /** Weekly pre-push: force library-only rows onto the Training Calendar. */
  recoverLibraryOnly?: boolean;
  athleteIds?: string[];
};

function resolvePushMode(
  garminWorkoutId: number | null,
  garminScheduleId: number | null,
  recoverLibraryOnly: boolean
): GarminPushMode | "skip_library_only" {
  if (garminWorkoutId != null && garminScheduleId == null) {
    return recoverLibraryOnly ? "force-reschedule" : "skip_library_only";
  }
  return garminScheduleId != null ? "update-library" : "schedule-today";
}

/** Exported for unit tests. */
export function resolveGarminPushModeForBatch(
  garminWorkoutId: number | null,
  garminScheduleId: number | null,
  recoverLibraryOnly: boolean
): GarminPushMode | "skip_library_only" {
  return resolvePushMode(garminWorkoutId, garminScheduleId, recoverLibraryOnly);
}

export type BatchPushCandidate = {
  id: string;
  athleteId: string | null;
  planId: string | null;
  date: Date | null;
  garminWorkoutId: number | null;
  garminScheduleId: number | null;
};

function batchCandidateGroupKey(w: BatchPushCandidate): string | null {
  if (!w.athleteId || !w.planId || !w.date) return null;
  return `${w.athleteId}|${w.planId}|${ymdFromDate(w.date)}`;
}

function batchCandidateRank(w: BatchPushCandidate): number {
  if (w.garminScheduleId != null) return 3;
  if (w.garminWorkoutId != null) return 2;
  return 1;
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

/**
 * Push materialized plan workouts in a date range to Garmin Training Calendar.
 * Reuses the single-workout push primitive and existing calendar-state modes.
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
    recoverLibraryOnly = false,
    athleteIds,
  } = options;

  console.info(`[${runLabel}] batch start`, {
    dateStart: dateStart.toISOString(),
    dateEnd: dateEnd.toISOString(),
    candidateLimit,
    recoverLibraryOnly,
    athleteFilterCount: athleteIds?.length ?? null,
  });

  const candidates = await prisma.workouts.findMany({
    where: {
      planId: { not: null },
      athleteId: { not: null },
      date: { gte: dateStart, lte: dateEnd },
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
      garminWorkoutId: true,
      garminScheduleId: true,
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

    const segCount = await prisma.workout_segments.count({
      where: { workoutId: w.id },
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

    const modeOrSkip = resolvePushMode(
      w.garminWorkoutId,
      w.garminScheduleId,
      recoverLibraryOnly
    );

    if (modeOrSkip === "skip_library_only") {
      skipped++;
      results.push({
        workoutId: w.id,
        athleteId,
        ok: true,
        skipped: true,
        action: "library_only_skip",
        error:
          "Garmin workout exists without calendar schedule id; use force-reschedule from GoFast to avoid duplicate calendar entries.",
      });
      continue;
    }

    const mode = modeOrSkip;
    const r = await pushWorkoutToGarminForAthlete(athleteId, w.id, { mode });
    if (r.ok) {
      if (mode === "update-library") {
        updated++;
      } else {
        scheduled++;
      }
      results.push({
        workoutId: w.id,
        athleteId,
        ok: true,
        action: mode,
        scheduledDate: r.scheduledDate,
        garminScheduleId: r.garminScheduleId,
      });
    } else {
      failed++;
      results.push({
        workoutId: w.id,
        athleteId,
        ok: false,
        action: mode,
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
