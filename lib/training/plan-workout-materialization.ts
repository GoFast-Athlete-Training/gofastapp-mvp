/**
 * **Hydrate** path: read saved `planWeeks` + `training_plans.currentFiveKPace` from the DB,
 * materialize missing week workouts + segments (see workout-segment-generator).
 * After the one-shot generate, `training_plans.id` + `athleteId` scope that source row — no regenerate.
 */

export type { TrainingPlanRowId } from "./persisted-training-plan";
export {
  workoutDaysRangeForWeek,
  weekBoundsFromPlan,
  type WeekBounds,
} from "./workout-days-range";
export {
  buildPlanWorkoutApiSegments,
  anchorSecondsPerMileFromPlanPace,
} from "./workout-segment-generator";
