/**
 * Workout-day hydration: planned prescribe row first; swap to spawned instance if found.
 * FIND only — never creates a workouts row.
 *
 * Same-id spawn: executed when a workouts row exists at plannedWorkoutId (id match).
 * Legacy FK spawn: workoutId on the card may differ; still kind executed.
 */

import type { PlanDayCard } from "./fetch-plan-week-client";

export type HydratedPlanDay =
  | {
      kind: "planned";
      day: PlanDayCard;
      plannedWorkoutId: string;
    }
  | {
      kind: "executed";
      day: PlanDayCard;
      plannedWorkoutId: string | null;
      workoutId: string;
    };

/** Instance exists for this plan day (same-id or legacy FK row on the card). */
export function isPlanDayExecuted(day: PlanDayCard): boolean {
  if (!day.plannedWorkoutId) return day.workoutId != null;
  return day.workoutId != null;
}

/**
 * Resolve workout-day surface from a week card row.
 * Canonical key is always plannedWorkoutId; executed when instance row exists.
 */
export function hydratePlanButSwapIfExecuted(
  day: PlanDayCard
): HydratedPlanDay | null {
  if (day.plannedWorkoutId && isPlanDayExecuted(day)) {
    return {
      kind: "executed",
      day,
      plannedWorkoutId: day.plannedWorkoutId,
      workoutId: day.workoutId!,
    };
  }
  if (day.plannedWorkoutId) {
    return {
      kind: "planned",
      day,
      plannedWorkoutId: day.plannedWorkoutId,
    };
  }
  if (day.workoutId) {
    return {
      kind: "executed",
      day,
      plannedWorkoutId: null,
      workoutId: day.workoutId,
    };
  }
  return null;
}

/** Id for manual Garmin match — planned id before spawn, instance id after (same string when spawned). */
export function matchTargetIdForHydrated(hydrated: HydratedPlanDay): string {
  return hydrated.kind === "executed"
    ? hydrated.workoutId
    : hydrated.plannedWorkoutId;
}

/** Open / review detail route id. Same-id spawn: workoutId === plannedWorkoutId. */
export function detailIdForHydrated(hydrated: HydratedPlanDay): string {
  return hydrated.kind === "executed"
    ? hydrated.workoutId
    : hydrated.plannedWorkoutId;
}

/** Schedule-run and prescribe actions — always the planned row when present. */
export function prescribeIdForHydrated(hydrated: HydratedPlanDay): string {
  if (hydrated.kind === "planned") return hydrated.plannedWorkoutId;
  return hydrated.plannedWorkoutId ?? hydrated.workoutId;
}
