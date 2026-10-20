import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultWorkPaceBandSecPerMile,
  seedWorkBlockPaceIfMissing,
  segmentToEditablePlanned,
} from "@/lib/training/planned-workout-segment-editable";

test("defaultWorkPaceBandSecPerMile seeds easy band from 5K anchor", () => {
  assert.deepEqual(defaultWorkPaceBandSecPerMile(386, "Easy"), { low: 460, high: 492 });
  assert.deepEqual(defaultWorkPaceBandSecPerMile(386, "Tempo"), { low: 401, high: 401 });
});

test("seedWorkBlockPaceIfMissing fills tempo work block without stored PACE", () => {
  const editable = segmentToEditablePlanned({
    id: "s1",
    stepOrder: 2,
    title: "Tempo",
    durationType: "DISTANCE",
    durationValue: 2,
    targets: [],
  });
  assert.equal(editable.paceLowMin, "");
  const seeded = seedWorkBlockPaceIfMissing(editable, "Tempo", "Tempo", 386);
  assert.equal(seeded.paceLowMin, "6");
  assert.equal(seeded.paceLowSec, "41");
});
