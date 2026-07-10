/**
 * Plan-scoped custom workouts policy.
 *
 * Athletes may author workouts attached to their own training_plans only.
 * These rows live in plan_custom_workouts — never in workout_catalogue.
 *
 * Publishing copies public-safe snapshots into public_training_plans.customWorkoutSnapshot.
 * Adoption materializes new plan_custom_workouts rows for the adopter.
 *
 * Promotion to the company catalogue requires a separate moderated path
 * (future community_workout_templates → staff review → workout_catalogue).
 */

export const PLAN_CUSTOM_WORKOUT_POLICY = {
  catalogueMutation: false,
  scope: "training_plan",
  publishLayer: "public_training_plans",
} as const;
