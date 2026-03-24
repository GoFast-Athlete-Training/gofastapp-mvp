/**
 * Garmin Workout API Types and Enums
 * Based on Garmin Connect Training API schema
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum GarminSport {
  RUNNING = "RUNNING",
  CYCLING = "CYCLING",
  SWIMMING = "SWIMMING",
  TRIATHLON = "TRIATHLON",
  // ... other sports (10 total options)
}

export enum GarminIntensity {
  WARMUP = "WARMUP",
  ACTIVE = "ACTIVE",
  RECOVERY = "RECOVERY",
  COOLDOWN = "COOLDOWN",
  REST = "REST",
  INTERVAL_TARGET = "INTERVAL_TARGET",
  INTERVAL_REST = "INTERVAL_REST",
}

export enum GarminDurationType {
  TIME = "TIME",
  DISTANCE = "DISTANCE",
  CALORIES = "CALORIES",
  HEART_RATE = "HEART_RATE",
  OPEN = "OPEN",
  // ... other duration types (15 total options)
}

export enum GarminTargetType {
  OPEN = "OPEN",                    // No target
  PACE = "PACE",                    // Pace target (seconds/km)
  HEART_RATE = "HEART_RATE",       // Heart rate (bpm)
  SPEED = "SPEED",                  // Speed (m/s or km/h)
  CADENCE = "CADENCE",              // Cadence (steps/min)
  POWER = "POWER",                  // Power (watts)
  GRADE = "GRADE",                  // Grade/incline (%)
  RESISTANCE = "RESISTANCE",        // Resistance level
  // ... other target types (18 total options)
}

export enum GarminValueType {
  TIME = "TIME",
  DISTANCE = "DISTANCE",
  CALORIES = "CALORIES",
  HEART_RATE = "HEART_RATE",
  PACE = "PACE",
}

export enum GarminRepeatType {
  DISTANCE = "DISTANCE",
  TIME = "TIME",
  // ... other repeat types (11 total options)
}

// ============================================================================
// TYPES
// ============================================================================

export interface GarminWorkoutStep {
  stepOrder: number;
  type: string; // "WorkoutStep" or "WorkoutRepeatStep"
  intensity?: GarminIntensity;
  description?: string;
  
  // Duration (HOW LONG)
  durationType?: GarminDurationType;
  durationValue?: number;
  durationValueType?: GarminValueType;
  
  // Target (WHAT TO AIM FOR)
  targetType?: GarminTargetType;
  targetValue?: number;           // Single target value
  targetValueLow?: number;         // Lower bound
  targetValueHigh?: number;        // Upper bound
  targetValueType?: GarminValueType;
  
  // Secondary target (can have BOTH pace AND HR!)
  secondaryTargetType?: GarminTargetType;
  secondaryTargetValue?: number;
  secondaryTargetValueLow?: number;
  secondaryTargetValueHigh?: number;
  secondaryTargetValueType?: GarminValueType;
  
  // For intervals/repeats
  repeatType?: GarminRepeatType;
  repeatValue?: number;
  skipLastRestStep?: boolean;
  
  // Other fields (swimming, strength, etc.)
  strokeType?: string;
  drillType?: string;
  equipmentType?: string;
  exerciseCategory?: string;
  exerciseName?: string;
  weightValue?: number;
  weightDisplayUnit?: string;
}

export interface GarminWorkout {
  workoutId?: number;              // Returned by Garmin after creation
  ownerId?: number;                // Garmin user ID
  workoutName: string;             // Required
  description?: string;
  sport: GarminSport;
  estimatedDurationInSecs?: number;
  estimatedDistanceInMeters?: number;
  poolLength?: number;
  poolLengthUnit?: string;
  workoutProvider?: string;
  workoutSourceId?: string;
  steps: GarminWorkoutStep[];
  updatedDate?: string;
  createdDate?: string;
  updatedTimeStamp?: number;
  createdTimeStamp?: number;
}

export interface GarminWorkoutSchedule {
  scheduleId?: number;
  workoutId: number;
  date: string; // YYYY-MM-DD format
}

export interface GarminWorkoutResponse {
  workoutId: number;
  // ... other response fields
}

// ============================================================================
// OUR MODEL TYPES (for conversion)
// ============================================================================

export interface OurWorkout {
  id: string;
  title: string;
  workoutType: string; // "Intervals" | "Tempo" | "LongRun" | "Easy"
  workoutFormat?: string; // "Continuous" | "WarmupMainCooldown" | "Progression" | "IntervalsUnstructured"
  description?: string;
  totalMiles?: number;
  warmUpMiles?: number;
  mainSetMiles?: number;
  coolDownMiles?: number;
  effortType?: string; // "FiveKEffort" | "TenKEffort" | etc.
  effortModifier?: number;
  athleteId: string;
}

export interface PlannedData {
  title: string;
  description?: string;
  workoutId?: string; // Reference to workouts.id
  paceGoals?: {
    target?: string; // "5:30/mile"
    min?: string;
    max?: string;
  };
  hrGoals?: {
    zone?: string;
    min?: number;
    max?: number;
  };
  distanceOverride?: number;
  notes?: string;
  // Garmin tracking
  garminWorkoutId?: number; // Garmin's workoutId after push
  garminScheduleId?: number; // If scheduled
  garminSyncedAt?: string; // ISO timestamp
}

export interface Athlete {
  id: string;
  garmin_user_id?: string;
  current5KPace?: string; // For pace calculations
  // ... other athlete fields
}

// ============================================================================
// CONVERSION HELPERS
// ============================================================================

/**
 * Convert pace string "X:XX/mile" to seconds per kilometer
 * Example: "5:30/mile" → 330 seconds/mile → 531 seconds/km
 */
export function convertPaceToSecondsPerKm(paceString: string): number {
  // Parse "5:30/mile" or "5:30" format
  const match = paceString.match(/(\d+):(\d+)/);
  if (!match) {
    throw new Error(`Invalid pace format: ${paceString}`);
  }
  
  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  const totalSecondsPerMile = minutes * 60 + seconds;
  
  // Convert to seconds per kilometer
  // 1 mile = 1.60934 km
  const secondsPerKm = totalSecondsPerMile * 1.60934;
  
  return Math.round(secondsPerKm);
}

/**
 * Convert miles to meters
 */
export function convertMilesToMeters(miles: number): number {
  return Math.round(miles * 1609.34);
}

/**
 * Convert minutes to seconds
 */
export function convertMinutesToSeconds(minutes: number): number {
  return Math.round(minutes * 60);
}
