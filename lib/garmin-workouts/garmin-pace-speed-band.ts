import {
  GarminTargetType,
  type GarminWorkoutStep,
} from "@/lib/garmin-workouts/types";
import {
  KM_PER_MILE,
  parsePaceToSecondsPerMile,
  secondsPerMileToSecondsPerKm,
} from "@/lib/workout-generator/pace-calculator";

const MIN_RUN_SPEED_MPS = 1.2;
const MAX_RUN_SPEED_MPS = 7.5;

function paceSecKmToSpeedMps(secPerKm: number): number {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) {
    throw new Error(`Garmin pace→speed: invalid sec/km (${secPerKm})`);
  }
  const secPerMile = secPerKm * KM_PER_MILE;
  const mph = 3600 / secPerMile;
  return mph * 0.44704;
}

function roundSpeedMps(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function assertRunningSpeedMps(mps: number, label: string): void {
  if (!Number.isFinite(mps) || mps < MIN_RUN_SPEED_MPS || mps > MAX_RUN_SPEED_MPS) {
    throw new Error(
      `Garmin ${label}: speed ${mps} m/s outside allowed running range [${MIN_RUN_SPEED_MPS}, ${MAX_RUN_SPEED_MPS}]`
    );
  }
}

/** Apply a pace band (min/mi strings) to a Garmin step as SPEED low/high. */
export function applyPaceBandMiStringsAsGarminSpeed(
  step: GarminWorkoutStep,
  paceLowMi: string,
  paceHighMi: string,
  stepOrder: number
): void {
  const secMiFast = parsePaceToSecondsPerMile(paceLowMi.trim());
  const secMiSlow = parsePaceToSecondsPerMile(paceHighMi.trim());
  const secKmFast = secondsPerMileToSecondsPerKm(Math.min(secMiFast, secMiSlow));
  const secKmSlow = secondsPerMileToSecondsPerKm(Math.max(secMiFast, secMiSlow));
  const mpsHigh = roundSpeedMps(paceSecKmToSpeedMps(secKmFast));
  const mpsLow = roundSpeedMps(paceSecKmToSpeedMps(secKmSlow));
  assertRunningSpeedMps(mpsLow, "speed low");
  assertRunningSpeedMps(mpsHigh, "speed high");

  step.targetType = GarminTargetType.SPEED;
  step.targetValueLow = mpsLow;
  step.targetValueHigh = mpsHigh;
  step.targetValue = undefined;

  void stepOrder;
}
