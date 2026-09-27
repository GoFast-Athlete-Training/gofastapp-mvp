import assert from "node:assert/strict";
import test from "node:test";
import {
  raceBlocksToRaceDaySegments,
  suggestRaceBlocksFromGoal,
} from "@/lib/races/race-pacing-blocks";

test("suggestRaceBlocksFromGoal: marathon negative split uses few blocks not 26", () => {
  const blocks = suggestRaceBlocksFromGoal({
    totalMiles: 26.2,
    goalPaceSecPerMi: 480,
    strategy: "negative",
  });
  assert.ok(blocks.length >= 3 && blocks.length <= 6);
  const sumMi = blocks.reduce((a, b) => a + b.miles, 0);
  assert.ok(Math.abs(sumMi - 26.2) < 0.15);
  assert.equal(blocks[0]?.kind, "warmup");
});

test("raceBlocksToRaceDaySegments preserves block titles", () => {
  const blocks = suggestRaceBlocksFromGoal({
    totalMiles: 13.1,
    goalPaceSecPerMi: 420,
    strategy: "even",
  });
  const segs = raceBlocksToRaceDaySegments(blocks);
  assert.equal(segs.length, blocks.length);
  assert.equal(segs[0]?.title, blocks[0]?.name);
  assert.ok(segs[0]?.targets?.[0]?.valueLow);
});
