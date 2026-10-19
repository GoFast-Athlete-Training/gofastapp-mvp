import assert from "node:assert/strict";
import test from "node:test";
import { goalPaceCheckpoints } from "./goal-pace-checkpoints";

/** 03:02:30 */
const MARATHON_GOAL_SEC = 3 * 3600 + 2 * 60 + 30;
const MARATHON_METERS = 42_195;
const MARATHON_MILES = MARATHON_METERS / 1609.344;

test("goalPaceCheckpoints: marathon finish equals goal clock", () => {
  const cps = goalPaceCheckpoints({
    goalSec: MARATHON_GOAL_SEC,
    totalMiles: MARATHON_MILES,
    totalMeters: MARATHON_METERS,
  });
  const labels = cps.map((c) => c.label);
  assert.deepEqual(labels, ["10K", "Half", "Finish"]);
  const finish = cps.find((c) => c.label === "Finish");
  assert.equal(Math.round(finish!.elapsedSec), MARATHON_GOAL_SEC);
});

test("goalPaceCheckpoints: marathon splits are even slices of goal", () => {
  const cps = goalPaceCheckpoints({
    goalSec: MARATHON_GOAL_SEC,
    totalMiles: MARATHON_MILES,
    totalMeters: MARATHON_METERS,
  });
  const tenK = cps.find((c) => c.label === "10K")!;
  const half = cps.find((c) => c.label === "Half")!;
  assert.equal(Math.round(tenK.elapsedSec), Math.round((MARATHON_GOAL_SEC * 10_000) / MARATHON_METERS));
  assert.equal(Math.round(half.elapsedSec), Math.round((MARATHON_GOAL_SEC * 21_097.5) / MARATHON_METERS));
});

test("goalPaceCheckpoints: 10K uses 5K and finish", () => {
  const goalSec = 50 * 60;
  const cps = goalPaceCheckpoints({
    goalSec,
    totalMiles: 10,
    totalMeters: 10_000,
  });
  const labels = cps.map((c) => c.label);
  assert.deepEqual(labels, ["5K", "10K", "Finish"]);
  assert.equal(Math.round(cps.find((c) => c.label === "Finish")!.elapsedSec), goalSec);
});
