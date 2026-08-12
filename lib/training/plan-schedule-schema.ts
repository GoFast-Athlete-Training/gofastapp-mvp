/**
 * Canonical structured plan schedule persisted on training_plans.planSchedule JSON.
 */

import type { WorkoutType } from "@prisma/client";

/** One prescribed day inside a plan week */
export type PlanDaySchedule = {
  /** Training DOW convention: 1=Monday … 7=Sunday */
  dow: number;
  workoutType: WorkoutType;
  /** Planned miles (including easy); materialized workouts may diverge slightly after edits */
  miles: number;
  catalogueWorkoutId: string | null;
  /** Rotation slot aligned with preset position lists; null when not applicable */
  planCycleIndex: number | null;
  /** Stamped after first materialization (structured schedules only, JSON on training_plans) */
  workoutId?: string | null;
  /** When set, this day is a race workout for this registry row (primary or secondary). */
  raceRegistryId?: string | null;
  /** Working-set identity — athlete_races.id */
  athleteRaceId?: string | null;
  planRaceEventRole?: "PRIMARY" | "SECONDARY" | null;
  /** Display name for secondary race days when expanding schedule to UI. */
  raceName?: string | null;
  /** Workout type replaced when a bolt-on race imprinted this day. */
  replacedWorkoutType?: string | null;
  /** Post-secondary-race recovery constraint — easy volume capped in distribute-easy. */
  recoveryAfterRace?: boolean;
};

export type PlanWeekSchedule = {
  weekNumber: number;
  days: PlanDaySchedule[];
};

export type LegacyPlanWeekSchedule = {
  weekNumber: number;
  schedule: string;
};

export function isStructuredPlanWeek(
  w: unknown
): w is PlanWeekSchedule {
  if (!w || typeof w !== "object") return false;
  const o = w as Record<string, unknown>;
  return (
    typeof o.weekNumber === "number" &&
    Array.isArray(o.days) &&
    o.days.length > 0 &&
    typeof (o.days[0] as PlanDaySchedule | undefined)?.dow === "number"
  );
}

export function planScheduleLooksStructured(planSchedule: unknown): boolean {
  if (!planSchedule || !Array.isArray(planSchedule)) return false;
  return planSchedule.some((w) => isStructuredPlanWeek(w));
}
