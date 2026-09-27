import { test } from "node:test";
import assert from "node:assert/strict";
import {
  apiSegmentsToFlatWorkBlocks,
  racePaceWorkBlocksToRaceDaySegments,
  tryParseTabularRacePacePaste,
} from "./race-pace-target-paste";

test("tryParseTabularRacePacePaste: label before pipe", () => {
  const text = "Open space for 5 | 5 7:00 7:20\nstart out strong | 3 6:50 7:10";
  const segs = tryParseTabularRacePacePaste(text);
  assert.ok(segs);
  assert.equal(segs.length, 2);
  assert.equal(segs[0].title, "Open space for 5");
  assert.equal(segs[0].durationValue, 5);
  assert.equal(segs[1].title, "start out strong");
});

test("apiSegmentsToFlatWorkBlocks keeps warmup titles as work blocks", () => {
  const blocks = apiSegmentsToFlatWorkBlocks([
    {
      stepOrder: 1,
      title: "Warmup mile",
      durationType: "DISTANCE",
      durationValue: 1,
      targets: [{ type: "PACE", valueLow: 300, valueHigh: 310 }],
    },
    {
      stepOrder: 2,
      title: "up north for hills",
      durationType: "DISTANCE",
      durationValue: 8,
      targets: [{ type: "PACE", valueLow: 280, valueHigh: 290 }],
    },
  ]);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].name, "Warmup mile");
  assert.equal(blocks[1].name, "up north for hills");
});

test("race day segments titled Race save as Work steps", () => {
  const blocks = apiSegmentsToFlatWorkBlocks([
    {
      stepOrder: 1,
      title: "Race",
      durationType: "DISTANCE",
      durationValue: 3,
      targets: [{ type: "PACE", valueLow: 260, valueHigh: 263 }],
    },
  ]);
  assert.equal(blocks[0]?.name, "Work");
  const segs = racePaceWorkBlocksToRaceDaySegments(blocks);
  assert.equal(segs[0]?.title, "Work");
});
