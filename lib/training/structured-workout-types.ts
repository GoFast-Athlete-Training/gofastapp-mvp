/** Workout types that require Garmin lap ↔ segment row alignment for target analysis. */
const STRUCTURED_TARGET_WORKOUT_TYPES = new Set(["Intervals", "Tempo"]);

export function requiresDetailForTargetAnalysis(workoutType: string): boolean {
  return STRUCTURED_TARGET_WORKOUT_TYPES.has(workoutType);
}
