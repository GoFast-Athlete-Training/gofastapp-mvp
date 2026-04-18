/**
 * Browser fetch helpers for plan detail + week schedule (from `planWeeks`, not workouts-first).
 */

import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";
import type { WeekPerformanceSnapshot } from "@/lib/training/week-performance-types";

export type { WeekPerformanceSnapshot };

export type PlanDayCard = {
  workoutId: string | null;
  dateKey: string;
  date: string;
  title: string;
  workoutType: string;
  phase: string;
  estimatedDistanceInMeters: number;
  matchedActivityId: string | null;
  actualDistanceMeters: number | null;
  actualAvgPaceSecPerMile: number | null;
  actualAverageHeartRate: number | null;
  actualDurationSeconds: number | null;
};

export async function fetchTrainingPlanDetail(
  planId: string,
  bearerToken: string
): Promise<{ plan: unknown; athleteFiveKPace: string | null }> {
  const res = await fetch(`/api/training-plan/${planId}`, {
    headers: athleteBearerFetchHeaders(bearerToken),
  });
  const data = (await res.json()) as {
    error?: string;
    plan?: unknown;
    athleteFiveKPace?: string | null;
  };
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Failed to load plan");
  }
  return { plan: data.plan, athleteFiveKPace: data.athleteFiveKPace ?? null };
}

/**
 * Week preview: `planWeeks` schedule + optional materialized workout ids.
 */
export async function fetchPlanWeekSchedule(
  planId: string,
  weekNumber: number,
  bearerToken: string
): Promise<{ days: PlanDayCard[]; weekPerformance: WeekPerformanceSnapshot | null }> {
  const res = await fetch(
    `/api/training/plan/week?planId=${encodeURIComponent(planId)}&weekNumber=${weekNumber}`,
    { headers: athleteBearerFetchHeaders(bearerToken) }
  );
  const data = (await res.json()) as {
    error?: string;
    days?: PlanDayCard[];
    weekPerformance?: WeekPerformanceSnapshot | null;
  };
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Failed to load week");
  }
  return {
    days: Array.isArray(data.days) ? data.days : [],
    weekPerformance: data.weekPerformance ?? null,
  };
}

/**
 * Resolve `workouts.id` for a calendar day (creates row + segments if needed).
 */
export async function resolveWorkoutForPlanDay(
  planId: string,
  dateKeyOrIso: string,
  bearerToken: string
): Promise<string> {
  const res = await fetch(
    `/api/training/workout/day?planId=${encodeURIComponent(planId)}&date=${encodeURIComponent(dateKeyOrIso)}`,
    { headers: athleteBearerFetchHeaders(bearerToken) }
  );
  const data = (await res.json()) as { error?: string; workoutId?: string };
  if (!res.ok || typeof data.workoutId !== "string") {
    throw new Error(
      typeof data.error === "string" ? data.error : "Could not open workout"
    );
  }
  return data.workoutId;
}

/** Full workout + segments (lazy segment creation may run on server for I/T). */
export async function fetchTrainingWorkoutDetail(
  workoutId: string,
  bearerToken: string
): Promise<{ workout: unknown }> {
  const res = await fetch(`/api/training/workout/${encodeURIComponent(workoutId)}`, {
    headers: athleteBearerFetchHeaders(bearerToken),
  });
  const data = (await res.json()) as { error?: string; workout?: unknown };
  if (!res.ok || data.workout == null) {
    throw new Error(typeof data.error === "string" ? data.error : "Failed to load workout");
  }
  return { workout: data.workout };
}
