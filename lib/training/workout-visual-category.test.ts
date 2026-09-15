import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveWorkoutVisualCategory,
  hasStructuredWorkReps,
  workoutTypeForVisualStyle,
} from "@/lib/training/workout-visual-category";

test("800 repeats intervals stays INTENSITY", () => {
  assert.equal(deriveWorkoutVisualCategory("Intervals", []), "INTENSITY");
  assert.equal(workoutTypeForVisualStyle("Intervals", []), "Intervals");
});

test("rolling 400s easy with reps is HYBRID", () => {
  const segments = [
    { title: "Warmup", repeatCount: 1 },
    { title: "400m", repeatCount: 8 },
    { title: "Cooldown", repeatCount: 1 },
  ];
  assert.ok(hasStructuredWorkReps(segments));
  assert.equal(deriveWorkoutVisualCategory("Easy", segments), "HYBRID");
  assert.equal(workoutTypeForVisualStyle("Easy", segments), "Intervals");
});

test("plain easy run is EASY", () => {
  assert.equal(deriveWorkoutVisualCategory("Easy", [{ title: "Easy" }]), "EASY");
});
