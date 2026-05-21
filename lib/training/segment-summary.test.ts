import assert from "node:assert/strict";
import test from "node:test";
import {
  expandSegmentsForGarminPush,
  formatGroupedSegmentDuration,
  groupSegmentsInDisplayOrder,
  milesToDisplayMeters,
} from "./segment-summary";

const M400 = 400 / 1609.34;

function seg(
  stepOrder: number,
  title: string,
  durationValue: number,
  extra: { repeatCount?: number } = {}
) {
  return {
    id: `seg-${stepOrder}`,
    stepOrder,
    title,
    durationType: "DISTANCE" as const,
    durationValue,
    repeatCount: extra.repeatCount ?? null,
  };
}

test("collapses flat interval + recovery pairs into one group with flatRepeatCount", () => {
  const segments = [
    seg(1, "Warmup", 1.5),
    seg(2, "Interval", M400),
    seg(3, "Recovery", 0.062),
    seg(4, "Interval", M400),
    seg(5, "Recovery", 0.062),
    seg(6, "Interval", M400),
    seg(7, "Cooldown", 1.5),
  ];
  const groups = groupSegmentsInDisplayOrder(segments);
  assert.equal(groups.length, 3);
  assert.equal(groups[1]!.work.title, "Interval");
  assert.equal(groups[1]!.flatRepeatCount, 3);
  assert.equal(groups[1]!.recovery?.title, "Recovery");
  assert.match(formatGroupedSegmentDuration(groups[1]!), /× 3$/);
});

test("preserves stored repeatCount on work rows", () => {
  const segments = [
    seg(1, "Interval", M400, { repeatCount: 8 }),
    seg(2, "Recovery", 0.062),
  ];
  const groups = groupSegmentsInDisplayOrder(segments);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]!.work.repeatCount, 8);
  assert.equal(groups[0]!.recovery?.title, "Recovery");
});

test("expandSegmentsForGarminPush stretches collapsed flat reps into repeatCount rows", () => {
  const segments = [
    seg(1, "Warmup", 1.5),
    seg(2, "Interval", M400),
    seg(3, "Recovery", 0.062),
    seg(4, "Interval", M400),
    seg(5, "Recovery", 0.062),
    seg(6, "Cooldown", 1.5),
  ];
  const out = expandSegmentsForGarminPush(segments);
  assert.equal(out.length, 4);
  assert.equal(out[1]!.title, "Interval");
  assert.equal(out[1]!.repeatCount, 2);
  assert.equal(out[2]!.title, "Recovery");
});

test("milesToDisplayMeters snaps 400m track reps to 400 not 401", () => {
  assert.equal(milesToDisplayMeters(M400), 400);
});
