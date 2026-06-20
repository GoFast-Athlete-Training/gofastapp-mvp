import assert from "node:assert/strict";
import test from "node:test";
import {
  displayWorkoutListTitle,
  formatPlannedWorkoutTitle,
  isGeneratedGenericWorkoutTitle,
  mergePlanDayTitle,
  resolveWorkoutDisplayTitle,
  stripLeadingDayNameFromTitle,
} from "./workout-display-title";

const SIX_MILES_METERS = 6 * 1609.34;

test("formatPlannedWorkoutTitle prefixes weekday on generic titles", () => {
  assert.equal(
    formatPlannedWorkoutTitle("Easy", SIX_MILES_METERS, { dayAssigned: "Monday" }),
    "Monday Easy 6 miles"
  );
  assert.equal(
    formatPlannedWorkoutTitle("Tempo", SIX_MILES_METERS, { dayAssigned: "Wednesday" }),
    "Wednesday Tempo work 6 miles"
  );
});

test("formatPlannedWorkoutTitle keeps race titles without weekday prefix", () => {
  assert.equal(
    formatPlannedWorkoutTitle("LongRun", SIX_MILES_METERS, {
      isRace: true,
      raceName: "Boston Marathon",
      dayAssigned: "Monday",
    }),
    "Race — Boston Marathon"
  );
});

test("stripLeadingDayNameFromTitle removes weekday prefix", () => {
  assert.equal(stripLeadingDayNameFromTitle("Monday Easy 6 miles"), "Easy 6 miles");
  assert.equal(stripLeadingDayNameFromTitle("Easy 6 miles"), "Easy 6 miles");
});

test("isGeneratedGenericWorkoutTitle detects Runna-style tempo title", () => {
  const generic = formatPlannedWorkoutTitle("Tempo", SIX_MILES_METERS);
  assert.equal(generic, "Tempo work 6 miles");
  assert.equal(
    isGeneratedGenericWorkoutTitle(generic, "Tempo", SIX_MILES_METERS),
    true
  );
});

test("isGeneratedGenericWorkoutTitle detects day-prefixed generic title", () => {
  const withDay = formatPlannedWorkoutTitle("Easy", SIX_MILES_METERS, {
    dayAssigned: "Monday",
  });
  assert.equal(withDay, "Monday Easy 6 miles");
  assert.equal(isGeneratedGenericWorkoutTitle(withDay, "Easy", SIX_MILES_METERS), true);
});

test("isGeneratedGenericWorkoutTitle treats legacy title without day as generic", () => {
  assert.equal(isGeneratedGenericWorkoutTitle("Easy 6 miles", "Easy", SIX_MILES_METERS), true);
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

test("mergePlanDayTitle prefers day-prefixed schedule title over legacy row title", () => {
  const merged = mergePlanDayTitle({
    rowTitle: "Easy 6 miles",
    scheduleTitle: "Monday Easy 6 miles",
    workoutType: "Easy",
    estimatedDistanceInMeters: SIX_MILES_METERS,
  });
  assert.equal(merged, "Monday Easy 6 miles");
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

test("resolveWorkoutDisplayTitle prefers schedule title over legacy generic stored title", () => {
  const title = resolveWorkoutDisplayTitle({
    title: "Easy 6 miles",
    workoutType: "Easy",
    estimatedDistanceInMeters: SIX_MILES_METERS,
    scheduleTitle: "Wednesday Easy 6 miles",
  });
  assert.equal(title, "Wednesday Easy 6 miles");
});

test("displayWorkoutListTitle preserves race titles", () => {
  const title = displayWorkoutListTitle({
    title: "Race — Boston Marathon",
    workoutType: "Race",
    estimatedDistanceInMeters: SIX_MILES_METERS,
  });
  assert.equal(title, "Race — Boston Marathon");
});
