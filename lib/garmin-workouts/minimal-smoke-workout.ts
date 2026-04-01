/**
 * Single-step running workout for Training API auth / schema smoke tests.
 */
import {
  GarminSport,
  GarminIntensity,
  GarminDurationType,
  GarminTargetType,
  type GarminWorkout,
} from "./types";

export function minimalSmokeGarminWorkout(): GarminWorkout {
  return {
    workoutName: "GoFast minimal smoke",
    description: "60s easy — API connectivity test (scripts/garmin-minimal-workout-smoke.ts)",
    sport: GarminSport.RUNNING,
    steps: [
      {
        stepOrder: 1,
        type: "WorkoutStep",
        intensity: GarminIntensity.ACTIVE,
        description: "Easy",
        durationType: GarminDurationType.TIME,
        durationValue: 60,
        targetType: GarminTargetType.OPEN,
      },
    ],
  };
}
