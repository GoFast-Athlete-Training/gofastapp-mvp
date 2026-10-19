import assert from "node:assert/strict";
import test from "node:test";
import {
  typeLabelForCard,
  workoutTypeAccentClass,
  workoutTypeLeftBorderClass,
  workoutTypeStripAccentClass,
  workoutTypeStripSurfaceClass,
} from "@/lib/training/plan-day-card-display";

test("workout type labels are explicit for calendar copy", () => {
  assert.equal(typeLabelForCard("Easy"), "Easy");
  assert.equal(typeLabelForCard("Tempo"), "Tempo");
  assert.equal(typeLabelForCard("Intervals"), "Intervals");
  assert.equal(typeLabelForCard("LongRun"), "Long run");
  assert.equal(typeLabelForCard("Race"), "Race");
});

test("quality workouts share one orange accent", () => {
  assert.equal(workoutTypeAccentClass("Tempo"), "bg-orange-500");
  assert.equal(workoutTypeAccentClass("Intervals"), "bg-orange-500");
  assert.notEqual(workoutTypeAccentClass("Easy"), workoutTypeAccentClass("Tempo"));
});

test("card rail and strip accent use the same mapping", () => {
  for (const type of ["Easy", "Tempo", "Intervals", "LongRun", "Race", "Rest"] as const) {
    assert.equal(workoutTypeLeftBorderClass(type), workoutTypeStripAccentClass(type));
  }
});

test("strip cells use neutral surfaces", () => {
  assert.match(workoutTypeStripSurfaceClass("Easy"), /bg-white/);
  assert.match(workoutTypeStripSurfaceClass("Tempo"), /bg-white/);
  assert.match(workoutTypeStripSurfaceClass("Rest"), /bg-gray-50/);
});
