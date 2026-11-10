/**
 * workoutpaceservice — apply athlete training paces to shape effort labels.
 */

import {
  getTrainingPaces,
  parsePaceToSecondsPerMile,
  paceTargetFromSecondsPerMile,
  secondsPerMileToSecondsPerKm,
  type TrainingPaces,
} from "@/lib/workout-generator/pace-calculator";
import type {
  ShapeStep,
  ShapeRepeatBlock,
  ShapeBookend,
  WorkoutShape,
  WorkoutShapePiece,
} from "@/lib/training/workout-shape-service";

export type PacedShapeStep = ShapeStep & {
  paceValueLow?: number;
  paceValueHigh?: number;
};

export type PacedRepeatBlock = Omit<ShapeRepeatBlock, "steps"> & {
  steps: PacedShapeStep[];
};

export type PacedWorkoutShapePiece = ShapeBookend | PacedRepeatBlock;

export type PacedWorkoutShape = {
  pieces: PacedWorkoutShapePiece[];
  suggestedTitle: string;
  suggestedDescription: string;
};

function bandFromSecPerMile(centerSecPerMile: number): { low: number; high: number } {
  const t = paceTargetFromSecondsPerMile(centerSecPerMile);
  const low = t.valueLow ?? centerSecPerMile;
  const high = t.valueHigh ?? low;
  return {
    low: secondsPerMileToSecondsPerKm(Math.min(low, high)),
    high: secondsPerMileToSecondsPerKm(Math.max(low, high)),
  };
}

function paceForLabel(
  label: string,
  paces: TrainingPaces,
  fiveKPaceDisplay: string | null | undefined
): { low: number; high: number } | null {
  const key = label.toLowerCase();
  let center: number | null = null;
  if (key === "10k" || key === "interval") center = paces.interval;
  else if (key === "tempo") center = paces.tempo;
  else if (key === "marathon") center = paces.marathon;
  else if (key === "steady" || key === "easy") center = paces.easy;
  else if (key === "work") center = paces.tempo;
  if (center == null && fiveKPaceDisplay?.trim()) {
    try {
      center = parsePaceToSecondsPerMile(fiveKPaceDisplay.trim());
    } catch {
      center = null;
    }
  }
  if (center == null) return null;
  return bandFromSecPerMile(center);
}

function paceStep(step: ShapeStep, paces: TrainingPaces, fiveK: string | null | undefined): PacedShapeStep {
  if (step.kind === "rest") return { ...step };
  const band = paceForLabel(step.effortLabel, paces, fiveK);
  if (!band) return { ...step };
  return { ...step, paceValueLow: band.low, paceValueHigh: band.high };
}

export function applyPacesToWorkoutShape(
  shape: WorkoutShape,
  options: {
    fiveKPaceDisplay?: string | null;
    goalPaceSecPerMile?: number | null;
  }
): PacedWorkoutShape {
  let anchor = options.goalPaceSecPerMile ?? null;
  if (anchor == null && options.fiveKPaceDisplay?.trim()) {
    try {
      anchor = parsePaceToSecondsPerMile(options.fiveKPaceDisplay.trim());
    } catch {
      anchor = 374;
    }
  }
  if (anchor == null) anchor = 374;
  const paces = getTrainingPaces(anchor);

  const pieces: PacedWorkoutShapePiece[] = shape.pieces.map((piece) => {
    if (piece.kind === "bookend") return piece;
    return {
      ...piece,
      steps: piece.steps.map((s) => paceStep(s, paces, options.fiveKPaceDisplay)),
    };
  });

  return {
    pieces,
    suggestedTitle: shape.suggestedTitle,
    suggestedDescription: shape.suggestedDescription,
  };
}
