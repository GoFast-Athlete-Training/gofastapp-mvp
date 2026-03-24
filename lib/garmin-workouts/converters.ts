/**
 * Converters: Our Model → Garmin Format
 * 
 * DEPRECATED: Use garmin-training-service.ts instead
 * This file kept for backwards compatibility during migration
 */

import {
  GarminWorkout,
  GarminWorkoutStep,
  GarminIntensity,
  GarminDurationType,
  GarminTargetType,
  GarminSport,
  GarminRepeatType,
  OurWorkout,
  PlannedData,
  Athlete,
  convertPaceToSecondsPerKm,
  convertMilesToMeters,
} from "./types";
import { assembleGarminWorkout, Workout, WorkoutSegment } from "./garmin-training-service";

// ============================================================================
// MAPPERS
// ============================================================================

/**
 * Map our workoutType to Garmin sport
 */
export function mapWorkoutTypeToSport(workoutType: string): GarminSport {
  switch (workoutType.toLowerCase()) {
    case "intervals":
    case "tempo":
    case "longrun":
    case "easy":
    case "speed":
      return GarminSport.RUNNING;
    case "strength":
      // Could be different sport or still RUNNING
      return GarminSport.RUNNING;
    default:
      return GarminSport.RUNNING;
  }
}

/**
 * Map our workoutType to Garmin intensity
 */
export function mapIntensity(
  workoutType: string,
  stepType: "warmup" | "main" | "cooldown" | "interval" | "recovery"
): GarminIntensity {
  switch (stepType) {
    case "warmup":
      return GarminIntensity.WARMUP;
    case "cooldown":
      return GarminIntensity.COOLDOWN;
    case "interval":
      return GarminIntensity.INTERVAL_TARGET;
    case "recovery":
      return GarminIntensity.INTERVAL_REST;
    case "main":
      return GarminIntensity.ACTIVE;
    default:
      return GarminIntensity.ACTIVE;
  }
}

/**
 * Get target configuration from plannedData (with priority)
 */
export function getTargetConfig(
  plannedData: PlannedData,
  athlete?: Athlete
): {
  targetType?: GarminTargetType;
  targetValueLow?: number;
  targetValueHigh?: number;
  secondaryTargetType?: GarminTargetType;
  secondaryTargetValueLow?: number;
  secondaryTargetValueHigh?: number;
} {
  const config: {
    targetType?: GarminTargetType;
    targetValueLow?: number;
    targetValueHigh?: number;
    secondaryTargetType?: GarminTargetType;
    secondaryTargetValueLow?: number;
    secondaryTargetValueHigh?: number;
  } = {};

  // Priority 1: Use paceGoals if provided
  if (plannedData.paceGoals?.target || plannedData.paceGoals?.min || plannedData.paceGoals?.max) {
    const minPace = plannedData.paceGoals.min || plannedData.paceGoals.target || plannedData.paceGoals.max;
    const maxPace = plannedData.paceGoals.max || plannedData.paceGoals.target || plannedData.paceGoals.min;
    
    if (minPace && maxPace) {
      config.targetType = GarminTargetType.PACE;
      config.targetValueLow = convertPaceToSecondsPerKm(minPace);
      config.targetValueHigh = convertPaceToSecondsPerKm(maxPace);
    }
  }

  // Priority 2: Use hrGoals if provided (can be secondary if pace is primary)
  if (plannedData.hrGoals?.min !== undefined || plannedData.hrGoals?.max !== undefined) {
    const hrMin = plannedData.hrGoals.min || plannedData.hrGoals.max;
    const hrMax = plannedData.hrGoals.max || plannedData.hrGoals.min;
    
    if (hrMin !== undefined && hrMax !== undefined) {
      // If we already have pace target, make HR secondary
      if (config.targetType === GarminTargetType.PACE) {
        config.secondaryTargetType = GarminTargetType.HEART_RATE;
        config.secondaryTargetValueLow = hrMin;
        config.secondaryTargetValueHigh = hrMax;
      } else {
        // HR is primary target
        config.targetType = GarminTargetType.HEART_RATE;
        config.targetValueLow = hrMin;
        config.targetValueHigh = hrMax;
      }
    }
  }

  // Priority 3: Derive from effortType + athlete paces (if no goals provided)
  if (!config.targetType && athlete?.current5KPace) {
    // Could derive pace from effortType here
    // For now, default to OPEN if nothing provided
  }

  return config;
}

// ============================================================================
// STEP BUILDERS
// ============================================================================

/**
 * Build a simple step: "Run 3 miles at pace"
 */
export function buildSimpleStep(
  stepOrder: number,
  distanceMiles: number,
  intensity: GarminIntensity,
  targetConfig: ReturnType<typeof getTargetConfig>,
  description?: string
): GarminWorkoutStep {
  const step: GarminWorkoutStep = {
    stepOrder,
    type: "WorkoutStep",
    intensity,
    durationType: GarminDurationType.DISTANCE,
    durationValue: convertMilesToMeters(distanceMiles),
  };

  if (description) {
    step.description = description;
  }

  // Add targets
  if (targetConfig.targetType) {
    step.targetType = targetConfig.targetType;
    if (targetConfig.targetValueLow !== undefined) {
      step.targetValueLow = targetConfig.targetValueLow;
    }
    if (targetConfig.targetValueHigh !== undefined) {
      step.targetValueHigh = targetConfig.targetValueHigh;
    }
  }

  // Add secondary target (e.g., HR if pace is primary)
  if (targetConfig.secondaryTargetType) {
    step.secondaryTargetType = targetConfig.secondaryTargetType;
    if (targetConfig.secondaryTargetValueLow !== undefined) {
      step.secondaryTargetValueLow = targetConfig.secondaryTargetValueLow;
    }
    if (targetConfig.secondaryTargetValueHigh !== undefined) {
      step.secondaryTargetValueHigh = targetConfig.secondaryTargetValueHigh;
    }
  }

  return step;
}

/**
 * Build interval step (for intervals workout)
 */
export function buildIntervalStep(
  stepOrder: number,
  distanceMeters: number,
  targetConfig: ReturnType<typeof getTargetConfig>,
  description?: string
): GarminWorkoutStep {
  return buildSimpleStep(
    stepOrder,
    distanceMeters / 1609.34, // Convert meters to miles for the function
    GarminIntensity.INTERVAL_TARGET,
    targetConfig,
    description
  );
}

/**
 * Build recovery step
 */
export function buildRecoveryStep(
  stepOrder: number,
  distanceMeters: number,
  description?: string
): GarminWorkoutStep {
  return {
    stepOrder,
    type: "WorkoutStep",
    intensity: GarminIntensity.INTERVAL_REST,
    description: description || "Recovery",
    durationType: GarminDurationType.DISTANCE,
    durationValue: distanceMeters,
    targetType: GarminTargetType.HEART_RATE,
    targetValueLow: 120,
    targetValueHigh: 140,
  };
}

/**
 * Build repeat step
 */
export function buildRepeatStep(
  stepOrder: number,
  repeatValue: number,
  repeatType: GarminRepeatType = GarminRepeatType.DISTANCE
): GarminWorkoutStep {
  return {
    stepOrder,
    type: "WorkoutRepeatStep",
    repeatType,
    repeatValue,
  };
}

// ============================================================================
// MAIN CONVERTER
// ============================================================================

/**
 * Convert our workout model + plannedData to Garmin workout format
 * 
 * DEPRECATED: Use assembleGarminWorkout() from garmin-training-service.ts instead
 */
export function convertWorkoutToGarminFormat(
  workout: OurWorkout,
  plannedData: PlannedData,
  athlete?: Athlete
): GarminWorkout {
  // Legacy conversion - try to convert old format
  // TODO: Migrate to use workout_segments table instead
  const sport = mapWorkoutTypeToSport(workout.workoutType);
  const workoutName = plannedData.title || workout.title;
  const description = plannedData.description || workout.description;
  
  // Get distance (use override if provided, otherwise from workout)
  const totalDistanceMiles = plannedData.distanceOverride || workout.totalMiles || 0;
  const totalDistanceMeters = convertMilesToMeters(totalDistanceMiles);
  
  // Get target configuration (pace/HR goals)
  const targetConfig = getTargetConfig(plannedData, athlete);
  
  // Build steps based on workoutFormat
  const steps: GarminWorkoutStep[] = [];
  let stepOrder = 1;
  
  if (workout.workoutFormat === "WarmupMainCooldown" || workout.workoutFormat === "IntervalsUnstructured") {
    // Warmup
    if (workout.warmUpMiles && workout.warmUpMiles > 0) {
      steps.push(
        buildSimpleStep(
          stepOrder++,
          workout.warmUpMiles,
          GarminIntensity.WARMUP,
          { targetType: GarminTargetType.HEART_RATE, targetValueLow: 120, targetValueHigh: 140 },
          "Warmup"
        )
      );
    }
    
    // Main set
    if (workout.workoutType === "Intervals" && workout.mainSetMiles) {
      // Intervals: add repeat block
      steps.push(buildRepeatStep(stepOrder++, 6, GarminRepeatType.DISTANCE)); // Default 6 repeats
      
      // Interval step (e.g., 800m)
      const intervalDistanceMeters = 800; // Could derive from workout
      steps.push(
        buildIntervalStep(
          stepOrder++,
          intervalDistanceMeters,
          targetConfig,
          "800m @ pace"
        )
      );
      
      // Recovery step
      steps.push(buildRecoveryStep(stepOrder++, 400, "Recovery jog"));
    } else {
      // Tempo or other: single main step
      const mainMiles = plannedData.distanceOverride 
        ? plannedData.distanceOverride - (workout.warmUpMiles || 0) - (workout.coolDownMiles || 0)
        : workout.mainSetMiles || workout.totalMiles || 0;
      
      steps.push(
        buildSimpleStep(
          stepOrder++,
          mainMiles,
          GarminIntensity.ACTIVE,
          targetConfig,
          "Main set"
        )
      );
    }
    
    // Cooldown
    if (workout.coolDownMiles && workout.coolDownMiles > 0) {
      steps.push(
        buildSimpleStep(
          stepOrder++,
          workout.coolDownMiles,
          GarminIntensity.COOLDOWN,
          { targetType: GarminTargetType.HEART_RATE, targetValueLow: 100, targetValueHigh: 120 },
          "Cooldown"
        )
      );
    }
  } else {
    // Continuous format: single step
    steps.push(
      buildSimpleStep(
        stepOrder++,
        totalDistanceMiles,
        GarminIntensity.ACTIVE,
        targetConfig,
        description || workoutName
      )
    );
  }
  
  return {
    workoutName,
    description,
    sport,
    estimatedDistanceInMeters: totalDistanceMeters,
    steps,
  };
}
