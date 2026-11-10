import {
  tryParsePastedWorkoutText,
  type ParsedPasteWorkout,
} from "@/lib/training/parse-pasted-workout";
import { workoutShapeFromParsed } from "@/lib/training/workout-shape-service";
import { applyPacesToWorkoutShape } from "@/lib/training/workout-pace-service";
import {
  assembleWorkoutStepsFromPacedShape,
  normalizeAiSegmentsForAssembler,
} from "@/lib/training/workout-assembler";
import type { WorkoutStep } from "@/lib/training/prescription";
import type { WorkoutShape } from "@/lib/training/workout-shape-service";

export function parsedPasteToWorkoutSteps(
  parsed: ParsedPasteWorkout,
  fiveKPaceDisplay: string | null | undefined
): WorkoutStep[] {
  const shape = workoutShapeFromParsed(parsed);
  const paced = applyPacesToWorkoutShape(shape, { fiveKPaceDisplay });
  return assembleWorkoutStepsFromPacedShape(paced);
}

export function buildShapeFromPasteText(
  sourceText: string,
  workoutTypeHint = "Easy"
): WorkoutShape | null {
  const parsed = tryParsePastedWorkoutText(sourceText, workoutTypeHint);
  if (!parsed) return null;
  return workoutShapeFromParsed(parsed);
}

export function pacedShapeFromConfirmed(
  shape: WorkoutShape,
  fiveKPaceDisplay: string | null | undefined
) {
  return applyPacesToWorkoutShape(shape, { fiveKPaceDisplay });
}

export function workoutStepsFromAiWithNormalize(
  segments: WorkoutStep[],
  shape: WorkoutShape | null,
  fiveKPaceDisplay: string | null | undefined
): WorkoutStep[] {
  if (shape) {
    const paced = applyPacesToWorkoutShape(shape, { fiveKPaceDisplay });
    return assembleWorkoutStepsFromPacedShape(paced);
  }
  return normalizeAiSegmentsForAssembler(segments);
}
