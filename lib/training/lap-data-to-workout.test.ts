import assert from "node:assert/strict";
import test from "node:test";
import type { DerivedLap } from "./lap-converter";
import { assignLapsForTest } from "./lap-data-to-workout";

const M400 = 400 / 1609.34;

function lap(
  lapIndex: number,
  paceSecPerMile: number | null = 400,
  distanceMiles = 0.37
): DerivedLap {
  return {
    lapIndex,
    startTimeInSeconds: lapIndex * 120,
    endTimeInSeconds: (lapIndex + 1) * 120,
    avgPaceSecPerMile: paceSecPerMile,
    avgHeartRate: null,
    distanceMiles,
    durationSeconds: 120,
  };
}

const intervalSegments = [
  {
    id: "w",
    stepOrder: 1,
    title: "Warmup",
    durationType: "DISTANCE",
    durationValue: 1,
    repeatCount: null,
    targets: null,
    paceTargetEncodingVersion: 2,
  },
  {
    id: "i1",
    stepOrder: 2,
    title: "Interval",
    durationType: "DISTANCE",
    durationValue: 0.37,
    repeatCount: null,
    targets: null,
    paceTargetEncodingVersion: 2,
  },
  {
    id: "r1",
    stepOrder: 3,
    title: "Recovery",
    durationType: "TIME",
    durationValue: 2,
    repeatCount: null,
    targets: null,
    paceTargetEncodingVersion: 2,
  },
  {
    id: "i2",
    stepOrder: 4,
    title: "Interval",
    durationType: "DISTANCE",
    durationValue: 0.37,
    repeatCount: null,
    targets: null,
    paceTargetEncodingVersion: 2,
  },
];

test("Intervals: 1:1 lap per segment row when counts match", () => {
  const derived = [lap(0, 540), lap(1, 375), lap(2, 720), lap(3, 370)];
  const result = assignLapsForTest(derived, intervalSegments, "Intervals");
  assert.ok(result);
  assert.equal(result.mode, "step");
  assert.equal(result.bySegment.get("r1")![0]!.lapIndex, 2);
  assert.equal(result.bySegment.get("i2")![0]!.avgPaceSecPerMile, 370);
});

test("Intervals: stepOrder consumption when lap count differs from segment rows", () => {
  const derived = [lap(0), lap(1), lap(2), lap(3), lap(4)];
  const result = assignLapsForTest(derived, intervalSegments, "Intervals");
  assert.ok(result);
  assert.equal(result.mode, "distance");
});

test("Tempo: early-advance warmup assigns short lap to warmup segment", () => {
  const segments = [
    {
      id: "warm",
      stepOrder: 1,
      title: "Warmup",
      durationType: "DISTANCE",
      durationValue: 1.5,
      repeatCount: null,
      targets: null,
      paceTargetEncodingVersion: 2,
    },
    {
      id: "work1",
      stepOrder: 2,
      title: "Tempo",
      durationType: "DISTANCE",
      durationValue: 2,
      repeatCount: null,
      targets: null,
      paceTargetEncodingVersion: 2,
    },
    {
      id: "work2",
      stepOrder: 3,
      title: "Tempo",
      durationType: "DISTANCE",
      durationValue: 1,
      repeatCount: null,
      targets: null,
      paceTargetEncodingVersion: 2,
    },
  ];
  const derived = [lap(0, 540, 0.7), lap(1, 420, 2.0), lap(2, 430, 1.0)];
  const result = assignLapsForTest(derived, segments, "Tempo");
  assert.ok(result);
  assert.equal(result.mode, "step");
  assert.equal(result.bySegment.get("warm")![0]!.distanceMiles, 0.7);
  assert.equal(result.bySegment.get("work1")![0]!.distanceMiles, 2.0);
  assert.equal(result.bySegment.get("work2")![0]!.distanceMiles, 1.0);
});

test("Tempo: stepOrder consumption when lap count differs from segment rows", () => {
  const segments = [
    {
      id: "warm",
      stepOrder: 1,
      title: "Warmup",
      durationType: "DISTANCE",
      durationValue: 1.5,
      repeatCount: null,
      targets: null,
      paceTargetEncodingVersion: 2,
    },
    {
      id: "work1",
      stepOrder: 2,
      title: "Tempo",
      durationType: "DISTANCE",
      durationValue: 2,
      repeatCount: null,
      targets: null,
      paceTargetEncodingVersion: 2,
    },
    {
      id: "work2",
      stepOrder: 3,
      title: "Tempo",
      durationType: "DISTANCE",
      durationValue: 1,
      repeatCount: null,
      targets: null,
      paceTargetEncodingVersion: 2,
    },
  ];
  const derived = [lap(0, 540, 0.7), lap(1, 420, 2.0), lap(2, 430, 1.0), lap(3, 440, 0.5)];
  const result = assignLapsForTest(derived, segments, "Tempo");
  assert.ok(result);
  assert.equal(result.mode, "distance");
  assert.equal(result.bySegment.get("warm")![0]!.distanceMiles, 0.7);
});

test("Easy: mile laps onto warmup / work / cooldown by stepOrder", () => {
  const segments = [
    {
      id: "w",
      stepOrder: 1,
      title: "Warmup",
      durationType: "DISTANCE",
      durationValue: 1,
      repeatCount: null,
      targets: null,
      paceTargetEncodingVersion: 2,
    },
    {
      id: "m",
      stepOrder: 2,
      title: "Easy",
      durationType: "DISTANCE",
      durationValue: 4,
      repeatCount: null,
      targets: null,
      paceTargetEncodingVersion: 2,
    },
    {
      id: "c",
      stepOrder: 3,
      title: "Cooldown",
      durationType: "DISTANCE",
      durationValue: 1,
      repeatCount: null,
      targets: null,
      paceTargetEncodingVersion: 2,
    },
  ];
  const derived = [lap(0, 540, 1), lap(1, 540, 1), lap(2, 540, 1), lap(3, 540, 1), lap(4, 540, 1), lap(5, 540, 1)];
  const result = assignLapsForTest(derived, segments, "Easy");
  assert.ok(result);
  assert.equal(result.mode, "distance");
  assert.equal(result.bySegment.get("w")!.length, 1);
  assert.equal(result.bySegment.get("m")!.length, 4);
  assert.equal(result.bySegment.get("c")!.length, 1);
});

test("collapsed 400x8: one work row with repeatCount 8 consumes eight 400m laps", () => {
  const segments = [
    {
      id: "w",
      stepOrder: 1,
      title: "Warmup",
      durationType: "DISTANCE",
      durationValue: 1,
      repeatCount: null,
      targets: null,
      paceTargetEncodingVersion: 2,
    },
    {
      id: "work",
      stepOrder: 2,
      title: "Interval",
      durationType: "DISTANCE",
      durationValue: M400,
      repeatCount: 8,
      targets: null,
      paceTargetEncodingVersion: 2,
    },
    {
      id: "c",
      stepOrder: 3,
      title: "Cooldown",
      durationType: "DISTANCE",
      durationValue: 1,
      repeatCount: null,
      targets: null,
      paceTargetEncodingVersion: 2,
    },
  ];
  const derived = [
    lap(0, 540, 1.0),
    ...Array.from({ length: 8 }, (_, i) => lap(i + 1, 375, M400)),
    lap(9, 540, 1.0),
  ];
  const result = assignLapsForTest(derived, segments, "Intervals");
  assert.ok(result);
  assert.equal(result.mode, "distance");
  assert.equal(result.bySegment.get("w")!.length, 1);
  assert.equal(result.bySegment.get("work")!.length, 8);
  assert.equal(result.bySegment.get("c")!.length, 1);
  for (const workLap of result.bySegment.get("work")!) {
    assert.ok(workLap.distanceMiles != null && workLap.distanceMiles < 0.9);
  }
});

test("mile repeats: one lap per rep on interval, no cooldown dump", () => {
  const segments = [
    {
      id: "w",
      stepOrder: 1,
      title: "Warmup",
      durationType: "DISTANCE",
      durationValue: 1,
      repeatCount: null,
      targets: null,
      paceTargetEncodingVersion: 2,
    },
    {
      id: "int",
      stepOrder: 2,
      title: "Interval",
      durationType: "DISTANCE",
      durationValue: 1,
      repeatCount: 5,
      targets: null,
      paceTargetEncodingVersion: 2,
    },
    {
      id: "r",
      stepOrder: 3,
      title: "Recovery",
      durationType: "TIME",
      durationValue: 2,
      repeatCount: null,
      targets: null,
      paceTargetEncodingVersion: 2,
    },
    {
      id: "c",
      stepOrder: 4,
      title: "Cooldown",
      durationType: "DISTANCE",
      durationValue: 1,
      repeatCount: null,
      targets: null,
      paceTargetEncodingVersion: 2,
    },
  ];
  const derived = [
    lap(0, 540, 0.04),
    lap(1, 372, 1.0),
    lap(2, 522, 1.0),
    lap(3, 377, 1.0),
    lap(4, 563, 1.0),
    lap(5, 370, 1.0),
    lap(6, 327, 0.04),
    lap(7, 346, 1.0),
    lap(8, 594, 1.0),
    lap(9, 416, 1.0),
    lap(10, 704, 1.0),
  ];
  const result = assignLapsForTest(derived, segments, "Intervals");
  assert.ok(result);
  assert.equal(result.bySegment.get("w")!.length, 1);
  assert.equal(result.bySegment.get("int")!.length, 5);
  assert.equal(result.bySegment.get("r")!.length, 1);
  assert.equal(result.bySegment.get("c")!.length, 1);
  const assigned = [...result.bySegment.values()].reduce((a, ls) => a + ls.length, 0);
  assert.equal(assigned, 8);
});

test("unassignable laps return null", () => {
  const segments = [
    {
      id: "w",
      stepOrder: 1,
      title: "Warmup",
      durationType: "DISTANCE",
      durationValue: 1,
      repeatCount: null,
      targets: null,
      paceTargetEncodingVersion: 2,
    },
  ];
  const result = assignLapsForTest([], segments, "Easy");
  assert.equal(result, null);
});
