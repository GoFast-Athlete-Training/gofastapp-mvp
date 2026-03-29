/**
 * Plan workout materialization: read persisted `planWeeks` + `training_plans.currentFiveKPace`,
 * project to workouts + segments (see workout-segment-generator).
 * Source of truth after generate is the DB row keyed by persisted plan id + athleteId.
 */

export type { PersistedTrainingPlanId } from "./persisted-training-plan";
export {
  workoutDaysRangeForWeek,
  weekBoundsFromPlan,
  type WeekBounds,
} from "./workout-days-range";
export {
  buildPlanWorkoutApiSegments,
  anchorSecondsPerMileFromPlanPace,
} from "./workout-segment-generator";
