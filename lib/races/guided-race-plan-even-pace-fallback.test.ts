import assert from "node:assert/strict";
import test from "node:test";
import { buildGuidedRaceStretches } from "./guided-race-plan";

test("buildGuidedRaceStretches with evenPaceFallback false returns empty when no segments", () => {
  const stretches = buildGuidedRaceStretches({
    segments: [],
    totalMiles: 26.2,
    goalPaceSecPerMi: 418,
    evenPaceFallback: false,
  });
  assert.equal(stretches.length, 0);
});
