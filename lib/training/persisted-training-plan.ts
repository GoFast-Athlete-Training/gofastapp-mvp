/**
 * Conceptual split: **generate** vs **read/hydrate** (no extra API fields — naming is for engineers only).
 *
 * - **Generate** — `POST /api/training/plan/generate` with
 *   `trainingPlanId` = `training_plans.id`, scoped by bearer `athleteId`. Writes **`planSchedule` + plan
 *   scalars only** (not `workouts` rows).
 * - **Week preview** — `GET /api/training/plan/week?planId=&weekNumber=` reads `planSchedule` and merges
 *   any materialized `workouts` for that week.
 * - **Open a day** — `GET /api/training/workout/day?planId=&date=` find-or-creates the `workouts` row
 *   from `planSchedule`. Detail + lazy segments: `GET /api/training/workout/[id]`.
 * - **Plan row** — `GET /api/training-plan/[id]`.
 *
 * All access: `where: { id: trainingPlanId | planId, athleteId }` from auth.
 */

/** Primary key of `training_plans` (cuid string). */
export type TrainingPlanRowId = string;
