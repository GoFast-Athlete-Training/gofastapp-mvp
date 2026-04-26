/**
 * Map bike_workout + steps → Garmin Training API workout payload (sport CYCLING).
 */

import type { bike_workout, bike_workout_step } from "@prisma/client";
import {
  GarminDurationType,
  GarminIntensity,
  GarminSport,
  GarminTargetType,
  GarminWorkout,
  GarminWorkoutStep,
} from "./types";

function mapIntensity(raw: string): GarminIntensity {
  const u = raw.trim().toUpperCase();
  if (u in GarminIntensity) {
    return GarminIntensity[u as keyof typeof GarminIntensity];
  }
  return GarminIntensity.ACTIVE;
}

export function assembleGarminBikeWorkout(
  workout: bike_workout & { steps: bike_workout_step[] }
): GarminWorkout {
  const sorted = [...workout.steps].sort((a, b) => a.stepOrder - b.stepOrder);
  const steps: GarminWorkoutStep[] = [];
  let order = 1;

  for (const s of sorted) {
    const step: GarminWorkoutStep = {
      stepOrder: order++,
      type: "WorkoutStep",
      intensity: mapIntensity(s.intensity),
      description: s.title,
    };

    const durType = s.durationType.trim().toUpperCase();
    if (durType === "OPEN") {
      step.durationType = GarminDurationType.OPEN;
    } else {
      step.durationType = GarminDurationType.TIME;
      const sec = s.durationSeconds ?? 0;
      if (sec <= 0) {
        throw new Error(`Bike step "${s.title}" must have durationSeconds > 0 unless durationType is OPEN`);
      }
      step.durationValue = sec;
    }

    if (s.powerWattsLow != null && s.powerWattsHigh != null) {
      step.targetType = GarminTargetType.POWER;
      step.targetValueLow = s.powerWattsLow;
      step.targetValueHigh = s.powerWattsHigh;
    } else if (s.powerWattsLow != null) {
      step.targetType = GarminTargetType.POWER;
      step.targetValue = s.powerWattsLow;
    } else {
      step.targetType = GarminTargetType.OPEN;
    }

    if (s.heartRateLow != null || s.heartRateHigh != null) {
      step.secondaryTargetType = GarminTargetType.HEART_RATE;
      if (s.heartRateLow != null) step.secondaryTargetValueLow = s.heartRateLow;
      if (s.heartRateHigh != null) step.secondaryTargetValueHigh = s.heartRateHigh;
    }

    if (s.cadenceLow != null || s.cadenceHigh != null) {
      if (step.secondaryTargetType) {
        throw new Error(
          `Bike step "${s.title}": only one secondary target supported (HR or cadence) for Garmin push`
        );
      }
      step.secondaryTargetType = GarminTargetType.CADENCE;
      if (s.cadenceLow != null) step.secondaryTargetValueLow = s.cadenceLow;
      if (s.cadenceHigh != null) step.secondaryTargetValueHigh = s.cadenceHigh;
    }

    steps.push(step);
  }

  const totalSec = sorted.reduce((sum, s) => {
    if (s.durationType.trim().toUpperCase() === "OPEN") return sum;
    return sum + (s.durationSeconds ?? 0) * (s.repeatCount && s.repeatCount > 0 ? s.repeatCount : 1);
  }, 0);

  return {
    workoutName: workout.title,
    description: workout.description ?? undefined,
    sport: GarminSport.CYCLING,
    estimatedDurationInSecs: totalSec > 0 ? totalSec : undefined,
    steps,
  };
}
