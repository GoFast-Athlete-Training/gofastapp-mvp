/**
 * Persisted training plan = one `training_plans` row (`training_plans.id`, cuid), always scoped by `athleteId`.
 *
 * Flow:
 * 1. **Create shell** — `POST /api/training-plan` returns the plan `id`. `planWeeks` is empty until generate.
 * 2. **Materialize once** — `POST /api/training-plan/generate` with `trainingPlanId` or `persist` writes
 *    `planWeeks`, syncs `currentFiveKPace`, creates `workouts` (+ segments per generator).
 * 3. **Hydrate** — `GET /api/training/week?planId=<id>` and lazy week materialization read **persisted**
 *    `planWeeks` + `currentFiveKPace` from Prisma. No re-run of generate; the DB row is source of truth.
 *
 * Client: keep this id in local state; send it as `planId` / `trainingPlanId` / `persist` plus bearer auth
 * so the server resolves `where: { id, athleteId }`.
 */

export type PersistedTrainingPlanId = string;

/** Accept `trainingPlanId` (primary) or `persist` (alias) from JSON body. */
export function persistedPlanIdFromRequestBody(
  body: Record<string, unknown>
): PersistedTrainingPlanId | undefined {
  const a = body.trainingPlanId;
  const b = body.persist;
  if (typeof a === "string" && a.trim()) return a.trim();
  if (typeof b === "string" && b.trim()) return b.trim();
  return undefined;
}
