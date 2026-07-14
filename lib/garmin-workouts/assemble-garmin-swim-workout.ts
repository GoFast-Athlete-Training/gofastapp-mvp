/**
 * Map swim_workout + steps → Garmin Training API workout payload (sport SWIMMING).
 * Pace targets attempted where supported; paceNote duplicated in step description for device fallback.
 */

import type { swim_workout, swim_workout_step } from "@prisma/client";
import {
  GarminDurationType,
  GarminIntensity,
  GarminSport,
  GarminTargetType,
  GarminWorkout,
  GarminWorkoutStep,
} from "./types";
import { formatSwimPaceNote } from "@/lib/training/swim-pace-resolver";

function mapIntensity(raw: string): GarminIntensity {
  const u = raw.trim().toUpperCase();
  if (u in GarminIntensity) {
    return GarminIntensity[u as keyof typeof GarminIntensity];
  }
  return GarminIntensity.ACTIVE;
}

function paceDescription(step: swim_workout_step): string | undefined {
  const parts: string[] = [];
  if (step.title) parts.push(step.title);
  if (step.paceNote) {
    parts.push(step.paceNote);
  } else if (step.paceSecPer100mLow != null && step.paceSecPer100mHigh != null) {
    parts.push(
      `${formatSwimPaceNote(step.paceSecPer100mLow)}–${formatSwimPaceNote(step.paceSecPer100mHigh)}`
    );
  } else if (step.paceSecPer100mLow != null) {
    parts.push(formatSwimPaceNote(step.paceSecPer100mLow));
  }
  if (step.notes) parts.push(step.notes);
  return parts.length > 0 ? parts.join(" — ") : undefined;
}

/**
 * Garmin swim pace targets use seconds per 100m in some API surfaces; we store sec/100m natively.
 * TODO(phase-2): verify against Garmin Training API swim workout samples on device.
 */
export function assembleGarminSwimWorkout(
  workout: swim_workout & { steps: swim_workout_step[] }
): GarminWorkout {
  const sorted = [...workout.steps].sort((a, b) => a.stepOrder - b.stepOrder);
  const steps: GarminWorkoutStep[] = [];
  let order = 1;

  for (const s of sorted) {
    const step: GarminWorkoutStep = {
      stepOrder: order++,
      type: "WorkoutStep",
      intensity: mapIntensity(s.intensity),
      description: paceDescription(s),
    };

    const durType = s.durationType.trim().toUpperCase();
    if (durType === "OPEN") {
      step.durationType = GarminDurationType.OPEN;
    } else if (durType === "DISTANCE" && s.durationMeters != null && s.durationMeters > 0) {
      step.durationType = GarminDurationType.DISTANCE;
      step.durationValue = s.durationMeters;
    } else if (durType === "TIME" && s.durationSeconds != null && s.durationSeconds > 0) {
      step.durationType = GarminDurationType.TIME;
      step.durationValue = s.durationSeconds;
    } else if (s.durationMeters != null && s.durationMeters > 0) {
      step.durationType = GarminDurationType.DISTANCE;
      step.durationValue = s.durationMeters;
    } else if (s.durationSeconds != null && s.durationSeconds > 0) {
      step.durationType = GarminDurationType.TIME;
      step.durationValue = s.durationSeconds;
    } else {
      step.durationType = GarminDurationType.OPEN;
    }

    if (s.paceSecPer100mLow != null && s.paceSecPer100mHigh != null) {
      step.targetType = GarminTargetType.PACE;
      step.targetValueLow = s.paceSecPer100mLow;
      step.targetValueHigh = s.paceSecPer100mHigh;
    } else if (s.paceSecPer100mLow != null) {
      step.targetType = GarminTargetType.PACE;
      step.targetValue = s.paceSecPer100mLow;
    } else {
      step.targetType = GarminTargetType.OPEN;
    }

    if (s.heartRateLow != null || s.heartRateHigh != null) {
      step.secondaryTargetType = GarminTargetType.HEART_RATE;
      if (s.heartRateLow != null) step.secondaryTargetValueLow = s.heartRateLow;
      if (s.heartRateHigh != null) step.secondaryTargetValueHigh = s.heartRateHigh;
    }

    if (s.strokeType) step.strokeType = s.strokeType;
    if (s.drillType) step.drillType = s.drillType;
    if (s.equipment) step.equipmentType = s.equipment;

    if (s.repeatCount != null && s.repeatCount > 1) {
      // Flat repeat: caller may wrap in WorkoutRepeatStep in phase-2 when rest steps are modeled.
      step.repeatType = undefined;
    }

    steps.push(step);
  }

  const totalMeters = sorted.reduce((sum, s) => {
    const reps = s.repeatCount && s.repeatCount > 0 ? s.repeatCount : 1;
    return sum + (s.durationMeters ?? 0) * reps;
  }, 0);

  return {
    workoutName: workout.title,
    description: workout.description ?? workout.notes ?? undefined,
    sport: GarminSport.SWIMMING,
    poolLength: workout.poolLengthMeters ?? undefined,
    poolLengthUnit: workout.poolLengthMeters ? "METER" : undefined,
    estimatedDistanceInMeters: totalMeters > 0 ? totalMeters : undefined,
    steps,
  };
}

// TODO(phase-2): WorkoutRepeatStep nesting for rep + restSeconds pairs; verify on Garmin watch.
// TODO(phase-2): wire through garmin-training-service push path (mirror run workout push).
