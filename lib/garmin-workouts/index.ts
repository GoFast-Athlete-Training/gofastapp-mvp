/**
 * Garmin Workouts - Main Export
 * 
 * Usage:
 * ```ts
 * import { assembleGarminWorkout, GarminWorkoutApiClient } from '@/lib/garmin-workouts';
 * 
 * // Assemble from workout + segments
 * const garminWorkout = assembleGarminWorkout(workout);
 * const client = new GarminWorkoutApiClient(accessToken);
 * const { workoutId } = await client.createWorkout(garminWorkout);
 * ```
 */

export * from "./types";
export * from "./garmin-training-service";
export * from "./api-client";
export * from "./activity-mapper";
// Legacy converters (deprecated) - only export non-conflicting functions
export {
  mapWorkoutTypeToSport,
  mapIntensity,
  getTargetConfig,
  buildSimpleStep,
  buildIntervalStep,
  buildRecoveryStep,
  buildRepeatStep,
  convertWorkoutToGarminFormat,
} from "./converters";
