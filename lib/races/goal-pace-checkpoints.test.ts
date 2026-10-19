import assert from "node:assert/strict";
import test from "node:test";
import { goalPaceCheckpoints } from "./goal-pace-checkpoints";

test("goalPaceCheckpoints: marathon uses 10K, half, finish", () => {
  const cps = goalPaceCheckpoints(26.2, 418);
  const labels = cps.map((c) => c.label);
  assert.deepEqual(labels, ["10K", "Half", "Finish"]);
  assert.equal(Math.round(cps[0]!.elapsedSec), Math.round(6.2 * 418));
});

test("goalPaceCheckpoints: 10K uses 5K and finish", () => {
  const cps = goalPaceCheckpoints(10, 400);
  const labels = cps.map((c) => c.label);
  assert.deepEqual(labels, ["5K", "10K", "Finish"]);
});
