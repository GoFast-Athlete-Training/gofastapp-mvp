import assert from "node:assert/strict";
import test from "node:test";
import { SEGMENT_METERS_PER_MILE } from "@/lib/training/segment-summary";
import {
  quickSegmentDurationForSave,
  workoutCardDistanceField,
  workoutCardDistanceKind,
} from "@/lib/training/workout-card-distance";

/** Catalogue materialization stores meters as miles rounded to 3 decimals. */
function catalogueMiles(meters: number): number {
  const f = 1000;
  return Math.round((meters / SEGMENT_METERS_PER_MILE) * f) / f;
}

test("200 m recovery displays as 200 m and is not a save rewrite", () => {
  const stored = catalogueMiles(200);
  assert.equal(stored, 0.124);
  const shown = workoutCardDistanceField({
    storedMiles: stored,
    kind: workoutCardDistanceKind("Recovery jog", "recovery"),
  });
  assert.equal(shown.value, "200");
  assert.equal(shown.unit, "m");
  assert.equal(quickSegmentDurationForSave("DISTANCE", "0.124", undefined), "0.124");
});

test("editing recovery from 200 m to 400 m saves exact miles", () => {
  const shown = workoutCardDistanceField({
    storedMiles: catalogueMiles(200),
    kind: "recovery",
    overrideValue: "400",
    overrideUnit: "m",
  });
  assert.equal(shown.value, "400");
  assert.equal(shown.unit, "m");

  const saved = quickSegmentDurationForSave("DISTANCE", shown.value, shown.unit);
  assert.equal(Number(saved), 400 / SEGMENT_METERS_PER_MILE);
  assert.equal(Math.round(Number(saved) * SEGMENT_METERS_PER_MILE), 400);
});

test("1000 m interval displays as 1000 m; warmup stays in miles", () => {
  const rep = workoutCardDistanceField({
    storedMiles: catalogueMiles(1000),
    kind: workoutCardDistanceKind("Interval", "work"),
  });
  assert.equal(rep.value, "1000");
  assert.equal(rep.unit, "m");

  const warmup = workoutCardDistanceField({
    storedMiles: 1.5,
    kind: workoutCardDistanceKind("Warmup", "work"),
  });
  assert.equal(warmup.value, "1.5");
  assert.equal(warmup.unit, "mi");
  assert.equal(quickSegmentDurationForSave("DISTANCE", "2", "mi"), "2");
});
