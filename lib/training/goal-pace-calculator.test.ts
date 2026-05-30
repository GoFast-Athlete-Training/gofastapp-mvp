import assert from "node:assert/strict";
import test from "node:test";
import {
  isPlausibleGoalPaceSecPerMile,
  resolveRacePaceSecondsPerMileForPlan,
} from "./goal-pace-calculator";

test("isPlausibleGoalPaceSecPerMile rejects finish-time fragments stored as pace", () => {
  assert.equal(isPlausibleGoalPaceSecPerMile(57 * 60 + 37), false);
  assert.equal(isPlausibleGoalPaceSecPerMile(412), true);
});

test("resolveRacePaceSecondsPerMileForPlan derives marathon pace from goal time", () => {
  const spm = resolveRacePaceSecondsPerMileForPlan({
    goalRacePace: "57:37",
    goalRaceTime: "3:57:37",
    raceDistanceMiles: 26.21875,
  });
  assert.ok(spm != null);
  assert.ok(spm! >= 480 && spm! <= 600);
});
