/**
 * Plan workout materialization: read planWeeks + training_plans.currentFiveKPace,
 * project to workouts + segments (see workout-segment-generator).
 */

export {
  workoutDaysRangeForWeek,
  weekBoundsFromPlan,
  type WeekBounds,
} from "./workout-days-range";
export {
  buildPlanWorkoutApiSegments,
  anchorSecondsPerMileFromPlanPace,
} from "./workout-segment-generator";
