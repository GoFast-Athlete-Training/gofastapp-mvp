import assert from "node:assert/strict";
import test from "node:test";
import { formatSegmentDistance } from "@/lib/training/segment-summary";
import {
  collapsePlannedSegmentsForDayPaceEditor,
  expandCollapsedDayPaceToFlatSegments,
  formatDistanceForDayPaceEdit,
  saveCollapsedDayPaceSegments,
} from "@/lib/training/day-plan-pace-splits-editor";
import type { PlannedWorkoutSegment } from "@/lib/training/planned-workout-segment-editable";

function intervalRep(order: number, miles: number, id: string): PlannedWorkoutSegment {
  return {
    id,
    stepOrder: order,
    title: "Interval",
    durationType: "DISTANCE",
    durationValue: miles,
    targets: [{ type: "PACE", valueLow: 350, valueHigh: 370 }],
  };
}

function recoveryRep(order: number, miles: number, id: string): PlannedWorkoutSegment {
  return {
    id,
    stepOrder: order,
    title: "Recovery",
    durationType: "DISTANCE",
    durationValue: miles,
    targets: [],
  };
}

test("formatSegmentDistance shows 100m for ~0.062 mi recovery", () => {
  const miles = Math.round((100 / 1609.34) * 1000) / 1000;
  assert.equal(formatSegmentDistance(miles), "100m");
});

test("collapse alternating 400x10 ladder into work and recovery cards", () => {
  const repM = Math.round((400 / 1609.34) * 1000) / 1000;
  const jogM = Math.round((100 / 1609.34) * 1000) / 1000;
  const flat: PlannedWorkoutSegment[] = [
    {
      id: "w",
      stepOrder: 1,
      title: "Warmup",
      durationType: "DISTANCE",
      durationValue: 1.5,
    },
  ];
  let order = 2;
  for (let r = 0; r < 10; r++) {
    flat.push(intervalRep(order++, repM, `i${r}`));
    if (r < 9) flat.push(recoveryRep(order++, jogM, `r${r}`));
  }
  flat.push({
    id: "c",
    stepOrder: order,
    title: "Cooldown",
    durationType: "DISTANCE",
    durationValue: 1.5,
  });

  const collapsed = collapsePlannedSegmentsForDayPaceEditor(flat, "Interval", 382);
  assert.equal(collapsed.length, 4);
  assert.equal(collapsed[0]!.editorKind, "warmup");
  assert.equal(collapsed[1]!.editorKind, "work");
  assert.equal(collapsed[1]!.displayRepCount, 10);
  assert.equal(collapsed[1]!.memberIds.length, 10);
  assert.equal(collapsed[2]!.editorKind, "recovery");
  assert.equal(collapsed[2]!.displayRepCount, 9);
  assert.equal(collapsed[2]!.paceLowMin, "");
  assert.equal(collapsed[3]!.editorKind, "cooldown");
  assert.equal(formatDistanceForDayPaceEdit(repM, "work"), "400");
  assert.equal(formatDistanceForDayPaceEdit(jogM, "recovery"), "100");
});

test("save expands one edit onto every flat rep", () => {
  const repM = 0.249;
  const jogM = 0.062;
  const flat: PlannedWorkoutSegment[] = [
    {
      id: "i0",
      stepOrder: 1,
      title: "Interval",
      durationType: "DISTANCE",
      durationValue: repM,
      targets: [{ type: "PACE", valueLow: 350, valueHigh: 370 }],
    },
    {
      id: "r0",
      stepOrder: 2,
      title: "Recovery",
      durationType: "DISTANCE",
      durationValue: jogM,
    },
    {
      id: "i1",
      stepOrder: 3,
      title: "Interval",
      durationType: "DISTANCE",
      durationValue: repM,
      targets: [{ type: "PACE", valueLow: 350, valueHigh: 370 }],
    },
  ];

  const collapsed = collapsePlannedSegmentsForDayPaceEditor(flat, "Interval", 382);
  const work = collapsed.find((c) => c.editorKind === "work")!;
  work.durationValue = "200";
  work.distanceUnit = "m";
  const payload = saveCollapsedDayPaceSegments(collapsed, flat);
  assert.equal(payload.length, 3);
  const miles200 = 200 / 1609.34;
  for (const row of payload) {
    if (row.title === "Interval") {
      assert.ok(Math.abs(Number(row.durationValue) - miles200) < 0.001);
    }
  }

  const reExpanded = expandCollapsedDayPaceToFlatSegments(collapsed, flat);
  assert.equal(reExpanded.length, 3);
});
