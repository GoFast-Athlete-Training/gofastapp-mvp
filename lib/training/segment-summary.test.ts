import assert from "node:assert/strict";
import test from "node:test";
import {
  expandSegmentsForGarminPush,
  formatBetweenRepeatsRecoveryLabel,
  formatGroupedSegmentDuration,
  formatRepeatBlockLabel,
  formatSegmentDistance,
  formatStructuredMilesTotal,
  groupSegmentsInDisplayOrder,
  isMultiStepRepeatGroup,
  humanDisplayGroupTitle,
  humanizeSegmentTitle,
  humanPlanStepSideTag,
  milesToDisplayMeters,
  segmentsMatchForRepeat,
} from "./segment-summary";

const M400 = 400 / 1609.34;

function seg(
  stepOrder: number,
  title: string,
  durationValue: number,
  extra: { repeatCount?: number; targets?: unknown; durationType?: "DISTANCE" | "TIME" } = {}
) {
  return {
    id: `seg-${stepOrder}`,
    stepOrder,
    title,
    durationType: extra.durationType ?? ("DISTANCE" as const),
    durationValue,
    repeatCount: extra.repeatCount ?? null,
    targets: extra.targets,
  };
}

const paceA = [{ type: "PACE", valueLow: 415, valueHigh: 447 }];
const paceB = [{ type: "PACE", valueLow: 380, valueHigh: 412 }];

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

test("collapses multi-step tempo block with rest between repeats", () => {
  const segments = [
    seg(1, "Warmup", 1.5),
    seg(2, "Tempo", 1, { targets: paceA }),
    seg(3, "Tempo", 1, { targets: paceB }),
    seg(4, "Recovery", 2, { durationType: "TIME" }),
    seg(5, "Tempo", 1, { targets: paceA }),
    seg(6, "Tempo", 1, { targets: paceB }),
    seg(7, "Cooldown", 1.5),
  ];
  const groups = groupSegmentsInDisplayOrder(segments);
  assert.equal(groups.length, 3);
  assert.equal(groups[0]!.work.title, "Warmup");
  assert.equal(groups[1]!.flatRepeatCount, 2);
  assert.equal(groups[1]!.cycleSteps?.length, 2);
  assert.equal(groups[1]!.betweenRepeatsRecovery?.title, "Recovery");
  assert.equal(formatRepeatBlockLabel(groups[1]!), "Repeat 2×");
  assert.equal(formatBetweenRepeatsRecoveryLabel(groups[1]!), "Between repeats: 2 min");
  assert.equal(groups[2]!.work.title, "Cooldown");
});

test("collapses Runna-style multi-step repeat with trailing rest", () => {
  const segments = [
    seg(1, "Warm-Up", 1),
    seg(2, "Tempo", 0.5, { targets: paceA }),
    seg(3, "Tempo", 0.5, { targets: paceB }),
    seg(4, "Tempo", 0.5, { targets: paceA }),
    seg(5, "Tempo", 0.5, { targets: paceB }),
    seg(6, "Tempo", 0.5, { targets: paceA }),
    seg(7, "Tempo", 0.5, { targets: paceB }),
    seg(8, "Rest", 1.5, { durationType: "TIME" }),
    seg(9, "Cool-down", 0.5),
  ];
  const groups = groupSegmentsInDisplayOrder(segments);
  assert.equal(groups.length, 4);
  assert.equal(isMultiStepRepeatGroup(groups[1]!), true);
  assert.equal(groups[1]!.flatRepeatCount, 3);
  assert.equal(groups[1]!.cycleSteps?.length, 2);
  assert.equal(groups[2]!.work.title, "Rest");
  assert.equal(groups[3]!.work.title, "Cool-down");
});

test("does not collapse same-distance steps with different pace targets", () => {
  const a = seg(1, "Tempo", 1, { targets: paceA });
  const b = seg(2, "Tempo", 1, { targets: paceB });
  assert.equal(segmentsMatchForRepeat(a, b), false);
  const groups = groupSegmentsInDisplayOrder([a, b]);
  assert.equal(groups.length, 2);
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

test("distance labels keep tenths for non-whole long runs", () => {
  assert.equal(formatStructuredMilesTotal(12.3), "12.3 mi");
  assert.equal(formatSegmentDistance(12.3), "12.3 mi");
});

test("humanizeSegmentTitle replaces raw Work with athlete-facing labels", () => {
  assert.equal(humanizeSegmentTitle("Work", "Tempo"), "Tempo");
  assert.equal(humanizeSegmentTitle("Work", "Intervals"), "Intervals");
  assert.equal(humanizeSegmentTitle("Work", "Easy"), "Easy run");
  assert.equal(humanizeSegmentTitle("Work"), "Main set");
  assert.equal(humanizeSegmentTitle("Recovery"), "Recovery");
});

test("humanDisplayGroupTitle uses workout type for lone Work segments", () => {
  const groups = groupSegmentsInDisplayOrder([seg(1, "Work", 3)]);
  assert.equal(humanDisplayGroupTitle(groups[0]!, "LongRun"), "Long run");
});

test("humanPlanStepSideTag hides redundant recovery chip", () => {
  assert.equal(humanPlanStepSideTag("Recovery"), null);
  assert.equal(humanPlanStepSideTag("Warm-up"), null);
  assert.equal(humanPlanStepSideTag("Work"), "Run");
});
