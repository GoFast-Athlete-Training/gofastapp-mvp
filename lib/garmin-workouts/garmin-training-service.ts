/**
 * Garmin Training Service
 * Assembles workouts + segments into Garmin format
 * 
 * This is the ONLY place that knows about Garmin's structure.
 * Everything else uses our clean workout/segment model.
 */

import {
  GarminWorkout,
  GarminWorkoutStep,
  GarminIntensity,
  GarminDurationType,
  GarminTargetType,
  GarminSport,
  GarminRepeatType,
  convertMilesToMeters,
  convertMinutesToSeconds,
} from "./types";
import {
  normalizePaceTargetEncodingVersion,
  paceTargetStoredToGarminSecPerKm,
} from "../workout-generator/pace-calculator";

export interface WorkoutSegment {
  id: string;
  workoutId: string;
  stepOrder: number;
  title: string;
  durationType: "DISTANCE" | "TIME";
  durationValue: number; // Miles (if DISTANCE) or minutes (if TIME)
  targets?: Array<{
    type: string; // "PACE", "HEART_RATE", "SPEED", etc.
    valueLow?: number;
    valueHigh?: number;
    value?: number; // Single value if no range
  }>;
  repeatCount?: number;
  notes?: string;
  paceTargetEncodingVersion?: number;
}

export interface Workout {
  id: string;
  title: string;
  workoutType: string;
  description?: string;
  segments: WorkoutSegment[];
}

/**
 * Assemble Garmin workout from our workout + segments
 * This is the ONLY conversion function - clean and extensible
 */
export function assembleGarminWorkout(workout: Workout): GarminWorkout {
  const sport = mapWorkoutTypeToSport(workout.workoutType);
  
  // Build steps from segments
  const steps = buildStepsFromSegments(workout.segments);
  
  // Calculate total distance (for display)
  const totalDistanceMeters = workout.segments.reduce((sum, seg) => {
    if (seg.durationType === "DISTANCE") {
      const segmentMeters = convertMilesToMeters(seg.durationValue);
      return sum + segmentMeters * (seg.repeatCount || 1);
    }
    return sum;
  }, 0);
  
  return {
    workoutName: workout.title,
    description: workout.description,
    sport,
    estimatedDistanceInMeters: totalDistanceMeters > 0 ? totalDistanceMeters : undefined,
    steps,
  };
}

/**
 * Build Garmin steps from our segments
 * Uses segment.stepOrder to match Garmin's stepOrder field
 */
function buildStepsFromSegments(segments: WorkoutSegment[]): GarminWorkoutStep[] {
  const steps: GarminWorkoutStep[] = [];
  let garminStepOrder = 1;
  
  // Sort segments by stepOrder (from our schema)
  const sortedSegments = [...segments].sort((a, b) => a.stepOrder - b.stepOrder);
  
  for (const segment of sortedSegments) {
    // If this segment repeats, create a repeat block
    if (segment.repeatCount && segment.repeatCount > 1) {
      // Add repeat step
      steps.push({
        stepOrder: garminStepOrder++,
        type: "WorkoutRepeatStep",
        repeatType: segment.durationType === "DISTANCE" 
          ? GarminRepeatType.DISTANCE 
          : GarminRepeatType.TIME,
        repeatValue: segment.repeatCount,
      });
      
      // Add the segment step (will be repeated) - use segment's stepOrder for reference
      steps.push(buildSegmentStep(garminStepOrder++, segment));
    } else {
      // Regular step (no repeat) - use segment's stepOrder for reference
      steps.push(buildSegmentStep(garminStepOrder++, segment));
    }
  }
  
  return steps;
}

/**
 * Build a single Garmin step from our segment
 * Handles conversion: minutes → seconds, miles → meters, targets JSON → Garmin format
 */
function buildSegmentStep(stepOrder: number, segment: WorkoutSegment): GarminWorkoutStep {
  const paceEnc = normalizePaceTargetEncodingVersion(segment.paceTargetEncodingVersion);
  const step: GarminWorkoutStep = {
    stepOrder,
    type: "WorkoutStep",
    intensity: mapIntensityFromTitle(segment.title),
    description: segment.title,
    durationType: segment.durationType === "DISTANCE" 
      ? GarminDurationType.DISTANCE 
      : GarminDurationType.TIME,
    durationValue: segment.durationType === "DISTANCE"
      ? convertMilesToMeters(segment.durationValue) // Convert miles to meters
      : convertMinutesToSeconds(segment.durationValue), // Convert minutes to seconds
  };
  
  // Parse targets JSON array
  if (segment.targets && segment.targets.length > 0) {
    // First target is primary
    const primaryTarget = segment.targets[0];
    const targetType = primaryTarget.type.toUpperCase() as keyof typeof GarminTargetType;
    
    if (GarminTargetType[targetType]) {
      step.targetType = GarminTargetType[targetType];
      
      const mapPace = (n: number | undefined): number | undefined => {
        if (n === undefined) return undefined;
        return paceTargetStoredToGarminSecPerKm(n, paceEnc);
      };

      // PACE values must be true sec/km on the wire; stored blobs may be v1 legacy
      if (GarminTargetType[targetType] === GarminTargetType.PACE) {
        if (primaryTarget.valueLow !== undefined) {
          step.targetValueLow = mapPace(primaryTarget.valueLow);
        }
        if (primaryTarget.valueHigh !== undefined) {
          step.targetValueHigh = mapPace(primaryTarget.valueHigh);
        }
        if (primaryTarget.value !== undefined && step.targetValueLow === undefined) {
          step.targetValue = mapPace(primaryTarget.value);
        }
      } else {
        if (primaryTarget.valueLow !== undefined) {
          step.targetValueLow = primaryTarget.valueLow;
        }
        if (primaryTarget.valueHigh !== undefined) {
          step.targetValueHigh = primaryTarget.valueHigh;
        }
        if (primaryTarget.value !== undefined && step.targetValueLow === undefined) {
          step.targetValue = primaryTarget.value;
        }
      }
      
      // Second target (if exists) becomes secondary target
      if (segment.targets.length > 1) {
        const secondaryTarget = segment.targets[1];
        const secondaryTargetType = secondaryTarget.type.toUpperCase() as keyof typeof GarminTargetType;
        
        if (GarminTargetType[secondaryTargetType]) {
          step.secondaryTargetType = GarminTargetType[secondaryTargetType];
          
          if (GarminTargetType[secondaryTargetType] === GarminTargetType.PACE) {
            if (secondaryTarget.valueLow !== undefined) {
              step.secondaryTargetValueLow = mapPace(secondaryTarget.valueLow);
            }
            if (secondaryTarget.valueHigh !== undefined) {
              step.secondaryTargetValueHigh = mapPace(secondaryTarget.valueHigh);
            }
            if (
              secondaryTarget.value !== undefined &&
              step.secondaryTargetValueLow === undefined
            ) {
              step.secondaryTargetValue = mapPace(secondaryTarget.value);
            }
          } else {
            if (secondaryTarget.valueLow !== undefined) {
              step.secondaryTargetValueLow = secondaryTarget.valueLow;
            }
            if (secondaryTarget.valueHigh !== undefined) {
              step.secondaryTargetValueHigh = secondaryTarget.valueHigh;
            }
            if (
              secondaryTarget.value !== undefined &&
              step.secondaryTargetValueLow === undefined
            ) {
              step.secondaryTargetValue = secondaryTarget.value;
            }
          }
        }
      }
    }
  } else {
    // No targets, default to OPEN
    step.targetType = GarminTargetType.OPEN;
  }
  
  return step;
}

/**
 * Map workout type to Garmin sport
 */
function mapWorkoutTypeToSport(workoutType: string): GarminSport {
  switch (workoutType.toLowerCase()) {
    case "intervals":
    case "tempo":
    case "longrun":
    case "easy":
    case "speed":
      return GarminSport.RUNNING;
    case "strength":
      return GarminSport.RUNNING; // Or could be different sport
    default:
      return GarminSport.RUNNING;
  }
}

/**
 * Map segment title to intensity (smart guess from title)
 */
function mapIntensityFromTitle(title: string): GarminIntensity {
  const lower = title.toLowerCase();
  
  if (lower.includes("warmup") || lower.includes("warm-up")) {
    return GarminIntensity.WARMUP;
  }
  if (lower.includes("cooldown") || lower.includes("cool-down")) {
    return GarminIntensity.COOLDOWN;
  }
  if (lower.includes("recovery") || lower.includes("rest")) {
    return GarminIntensity.INTERVAL_REST;
  }
  if (lower.includes("interval") || lower.includes("repeat")) {
    return GarminIntensity.INTERVAL_TARGET;
  }
  
  return GarminIntensity.ACTIVE;
}
