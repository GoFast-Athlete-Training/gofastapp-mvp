/**
 * Conceptual split: **generate** vs **hydrate** (no extra API fields — naming is for engineers only).
 *
 * - **Generate** — `POST /api/training-plan/generate` with `trainingPlanId` = `training_plans.id`, scoped
 *   by bearer `athleteId`. One-shot materialization writes `planWeeks`, `currentFiveKPace`, `workouts`.
 * - **Hydrate** — `GET /api/training/week?planId=…`, `GET /api/training-plan/[id]`, and lazy week
 *   materialization read that row from Prisma (`planWeeks`, pace, etc.). They do **not** re-run generate.
 *
 * All access: `where: { id: trainingPlanId | planId, athleteId }` from auth.
 */

/** Primary key of `training_plans` (cuid string). */
export type TrainingPlanRowId = string;
