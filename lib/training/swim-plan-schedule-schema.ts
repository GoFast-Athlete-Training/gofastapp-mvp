/**
 * Canonical structured swim plan schedule rows (JSON) — mirrors run planSchedule shape but in meters.
 * Persisted on future swim_training_plans.planSchedule (phase-2 table).
 */

import type { SwimWorkoutType } from "@prisma/client";

/** One prescribed swim day inside a plan week */
export type SwimPlanDaySchedule = {
  /** Training DOW convention: 1=Monday … 7=Sunday */
  dow: number;
  workoutType: SwimWorkoutType;
  /** Planned meters for the day (quality + filler); materialized workouts may diverge after edits */
  meters: number;
  catalogueWorkoutId: string | null;
  /** Rotation slot aligned with preset position lists; null when not applicable */
  planCycleIndex: number | null;
  /** Stamped after first materialization */
  swimWorkoutId?: string | null;
};

export type SwimPlanWeekSchedule = {
  weekNumber: number;
  /** Total planned meters for the week (before athlete edits) */
  weeklyMeters: number;
  /** True when week is in taper block before goal race */
  isTaperWeek?: boolean;
  days: SwimPlanDaySchedule[];
};

export function isStructuredSwimPlanWeek(w: unknown): w is SwimPlanWeekSchedule {
  if (!w || typeof w !== "object") return false;
  const o = w as Record<string, unknown>;
  return (
    typeof o.weekNumber === "number" &&
    typeof o.weeklyMeters === "number" &&
    Array.isArray(o.days) &&
    o.days.length > 0 &&
    typeof (o.days[0] as SwimPlanDaySchedule | undefined)?.dow === "number"
  );
}

export function swimPlanScheduleLooksStructured(planSchedule: unknown): boolean {
  if (!planSchedule || !Array.isArray(planSchedule)) return false;
  return planSchedule.some((w) => isStructuredSwimPlanWeek(w));
}

/** Generated swim plan athlete fields — NOT on preset */
export type SwimAthletePlanVolume = {
  /** Athlete-selected target; must pass validateTargetWeeklyMeters against preset min/max */
  targetWeeklyMeters: number;
  /** Rolling actual / prescribed total for current week */
  currentWeeklyMeters?: number;
  /** Derived long swim distance for current week */
  currentLongSwimLength?: number;
};
