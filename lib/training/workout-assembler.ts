/**
 * workoutassembler — paced shape → API workout steps (one repeat block, not per-step repeatCount).
 */

import type { WorkoutStep } from "@/lib/training/prescription";
import type { PacedWorkoutShape, PacedShapeStep } from "@/lib/training/workout-pace-service";

function targetsFromPacedStep(step: PacedShapeStep): WorkoutStep["targets"] {
  if (step.kind === "rest") return undefined;
  if (step.paceValueLow == null && step.paceValueHigh == null) return undefined;
  const low = step.paceValueLow ?? step.paceValueHigh!;
  const high = step.paceValueHigh ?? low;
  return [{ type: "PACE", valueLow: Math.min(low, high), valueHigh: Math.max(low, high) }];
}

function stepToWorkoutStep(step: PacedShapeStep, stepOrder: number, title?: string): WorkoutStep {
  return {
    stepOrder,
    title: title ?? (step.kind === "rest" ? "Recovery" : step.title),
    durationType: step.durationType,
    durationValue: step.durationValue,
    repeatCount: 1,
    targets: targetsFromPacedStep(step),
  };
}

/**
 * Build workout segments from a paced shape. Multi-step repeats materialize as flat cycles
 * so groupSegmentsInDisplayOrder collapses them into one Repeat N× card.
 */
export function assembleWorkoutStepsFromPacedShape(shape: PacedWorkoutShape): WorkoutStep[] {
  const out: WorkoutStep[] = [];
  let stepOrder = 1;

  for (const piece of shape.pieces) {
    if (piece.kind === "bookend") {
      out.push({
        stepOrder: stepOrder++,
        title: piece.title,
        durationType: piece.durationType,
        durationValue: piece.durationValue,
        repeatCount: 1,
      });
      continue;
    }

    const { repeatCount, steps, betweenRepRest } = piece;
    if (steps.length === 1 && steps[0].kind === "effort") {
      const only = steps[0];
      out.push({
        stepOrder: stepOrder++,
        title: only.title,
        durationType: only.durationType,
        durationValue: only.durationValue,
        repeatCount: repeatCount > 1 ? repeatCount : undefined,
        targets: targetsFromPacedStep(only),
        recoveryDurationType: betweenRepRest?.durationType ?? null,
        recoveryDurationValue: betweenRepRest?.durationValue ?? null,
      });
      continue;
    }

    for (let r = 0; r < repeatCount; r++) {
      for (const step of steps) {
        out.push(stepToWorkoutStep(step, stepOrder++));
      }
      if (r < repeatCount - 1 && betweenRepRest) {
        out.push({
          stepOrder: stepOrder++,
          title: "Recovery",
          durationType: betweenRepRest.durationType,
          durationValue: betweenRepRest.durationValue,
          repeatCount: 1,
        });
      }
    }
  }

  return out;
}

/** Fold AI pairs: same repeatCount on two consecutive TIME steps → flat cycle rows. */
export function normalizeAiSegmentsForAssembler(segments: WorkoutStep[]): WorkoutStep[] {
  const out: WorkoutStep[] = [];
  let i = 0;
  while (i < segments.length) {
    const a = segments[i]!;
    const b = segments[i + 1];
    const repsA = a.repeatCount ?? 1;
    const repsB = b?.repeatCount ?? 1;
    const sameTime =
      b &&
      a.durationType === "TIME" &&
      b.durationType === "TIME" &&
      a.durationValue === b.durationValue &&
      repsA > 1 &&
      repsA === repsB &&
      !a.recoveryDurationType &&
      !b.recoveryDurationType;

    if (sameTime) {
      for (let r = 0; r < repsA; r++) {
        out.push({ ...a, stepOrder: out.length + 1, repeatCount: 1 });
        out.push({ ...b, stepOrder: out.length + 1, repeatCount: 1 });
      }
      i += 2;
      continue;
    }
    out.push({ ...a, stepOrder: out.length + 1 });
    i += 1;
  }
  return out;
}
