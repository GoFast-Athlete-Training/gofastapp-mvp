import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEvenPaceMileStretches,
  buildGuidedRaceStretches,
} from "./guided-race-plan";

test("buildGuidedRaceStretches falls back to even-pace miles when no course segments", () => {
  const stretches = buildGuidedRaceStretches({
    segments: [],
    totalMiles: 10,
    goalPaceSecPerMi: 414,
  });
  assert.equal(stretches.length, 10);
  assert.match(stretches[0]!.title, /Mile 1/);
});

test("buildEvenPaceMileStretches emits one row per mile for 10 miles", () => {
  const stretches = buildEvenPaceMileStretches(10, 414);
  assert.equal(stretches.length, 10);
  assert.match(stretches[9]!.title, /Mile 10|Finish/);
});
