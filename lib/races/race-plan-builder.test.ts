import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRacePlanDocument } from "./race-plan-builder";

const SAMPLE = `Boulderthon Marathon Race Plan

Goal: Controlled opening, hold approximately 7:03/mi through the difficult northern sections.

BLOCK 1 — Miles 0.0 to 3.0
Target Pace: 7:03-7:07/mi
Effort: Easy controlled
Instruction: Settle down. Get through the opening miles without racing anyone.
Cue: EASY OUT

BLOCK 2 — Miles 3.0 to 6.0
Target Pace: 7:02-7:05/mi
Effort: Controlled
Instruction: Continue leaving Boulder.
Cue: SETTLE

Primary rule:
Do not bank time early. Hold approximately 7:03/mi through the northern half.
`;

test("parseRacePlanDocument reads blocks with cue and pace band", () => {
  const doc = parseRacePlanDocument(SAMPLE);
  assert.equal(doc.blocks.length, 2);
  assert.equal(doc.blocks[0]?.cue, "EASY OUT");
  assert.equal(doc.blocks[0]?.paceLow, "7:03");
  assert.equal(doc.blocks[0]?.paceHigh, "7:07");
  assert.equal(doc.blocks[0]?.mileStart, 0);
  assert.equal(doc.blocks[0]?.mileEnd, 3);
  assert.match(doc.goal, /Controlled opening/i);
  assert.match(doc.primaryRule, /Do not bank time early/i);
});

const MCM_CSV = `mile_start,mile_end,target_pace,pace_min,pace_max,focus
0,1,6:58,6:53,7:03,"Clear congestion, establish rhythm"
1,2,7:07,7:02,7:12,"Rosslyn ascent"
25,26,6:35,6:30,6:40,"Kick if available"
26,26.2,,,,"Finish hill, by effort"
`;

test("parseRacePlanDocument reads mile CSV with quoted focus and skips empty pace row", () => {
  const doc = parseRacePlanDocument(MCM_CSV);
  assert.equal(doc.blocks.length, 3);
  assert.equal(doc.goal, "");
  assert.equal(doc.primaryRule, "");
  assert.equal(doc.blocks[0]?.mileStart, 0);
  assert.equal(doc.blocks[0]?.mileEnd, 1);
  assert.equal(doc.blocks[0]?.paceLow, "6:53");
  assert.equal(doc.blocks[0]?.paceHigh, "7:03");
  assert.equal(doc.blocks[0]?.cue, "Clear congestion, establish rhythm");
  assert.equal(doc.blocks[2]?.cue, "Kick if available");
});

test("parseRacePlanDocument rejects mile CSV with no valid pace rows", () => {
  assert.throws(
    () =>
      parseRacePlanDocument(`mile_start,mile_end,target_pace,pace_min,pace_max,focus
26,26.2,,,,"Finish only"`),
    /Could not parse mile CSV/
  );
});
