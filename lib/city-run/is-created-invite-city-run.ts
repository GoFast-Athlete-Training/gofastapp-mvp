/** True when this city run is an athlete social invite, not a plan-day or club prescribe surface. */
export function isCreatedInviteCityRun(run: {
  plannedWorkoutId: string | null;
  workout: { planId: string | null } | null;
  planned_workouts: Array<{ planId: string | null }>;
}): boolean {
  if (run.plannedWorkoutId) return false;
  if (run.workout?.planId) return false;
  if (run.planned_workouts.some((row) => row.planId != null)) return false;
  return true;
}
