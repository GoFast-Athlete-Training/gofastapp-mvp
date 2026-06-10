import assert from "node:assert/strict";
import test from "node:test";
import {
  displayWorkoutListTitle,
  formatPlannedWorkoutTitle,
  isGeneratedGenericWorkoutTitle,
  mergePlanDayTitle,
  resolveWorkoutDisplayTitle,
} from "./workout-display-title";

const SIX_MILES_METERS = 6 * 1609.34;

test("isGeneratedGenericWorkoutTitle detects Runna-style tempo title", () => {
  const generic = formatPlannedWorkoutTitle("Tempo", SIX_MILES_METERS);
  assert.equal(generic, "Tempo work 6 miles");
  assert.equal(
    isGeneratedGenericWorkoutTitle(generic, "Tempo", SIX_MILES_METERS),
    true
  );
});

test("isGeneratedGenericWorkoutTitle detects AI fallback tempo title", () => {
  assert.equal(
    isGeneratedGenericWorkoutTitle("Tempo 6 Miles", "Tempo", SIX_MILES_METERS),
    true
  );
});

test("isGeneratedGenericWorkoutTitle keeps catalogue-specific names", () => {
  assert.equal(
    isGeneratedGenericWorkoutTitle("Cruise Intervals", "Tempo", SIX_MILES_METERS),
    false
  );
});

test("mergePlanDayTitle prefers schedule catalogue title over generic row title", () => {
  const merged = mergePlanDayTitle({
    rowTitle: "Tempo work 6 miles",
    scheduleTitle: "Cruise Intervals",
    workoutType: "Tempo",
    estimatedDistanceInMeters: SIX_MILES_METERS,
  });
  assert.equal(merged, "Cruise Intervals");
});

test("mergePlanDayTitle keeps custom stored row title", () => {
  const merged = mergePlanDayTitle({
    rowTitle: "My custom tempo",
    scheduleTitle: "Cruise Intervals",
    workoutType: "Tempo",
    estimatedDistanceInMeters: SIX_MILES_METERS,
  });
  assert.equal(merged, "My custom tempo");
});

test("resolveWorkoutDisplayTitle prefers catalogue name on workout detail", () => {
  const title = resolveWorkoutDisplayTitle({
    title: "Tempo work 6 miles",
    workoutType: "Tempo",
    estimatedDistanceInMeters: SIX_MILES_METERS,
    catalogueName: "Cruise Intervals",
  });
  assert.equal(title, "Cruise Intervals");
});

test("displayWorkoutListTitle preserves race titles", () => {
  const title = displayWorkoutListTitle({
    title: "Race — Boston Marathon",
    workoutType: "Race",
    estimatedDistanceInMeters: SIX_MILES_METERS,
  });
  assert.equal(title, "Race — Boston Marathon");
});
