import assert from "node:assert/strict";
import test from "node:test";
import { pacingBlocksToRacePlanDocument } from "./race-plan-from-pacing";
import { suggestRaceBlocksFromGoal } from "./race-pacing-blocks";

test("pacingBlocksToRacePlanDocument covers full race distance", () => {
  const blocks = suggestRaceBlocksFromGoal({
    totalMiles: 10,
    goalPaceSecPerMi: 414,
    strategy: "even",
  });
  const doc = pacingBlocksToRacePlanDocument({
    goalTimeDisplay: "1:09:00",
    blocks,
  });
  assert.ok(doc.blocks.length > 0);
  const last = doc.blocks[doc.blocks.length - 1]!;
  assert.ok(Math.abs(last.mileEnd - 10) < 0.05);
});
