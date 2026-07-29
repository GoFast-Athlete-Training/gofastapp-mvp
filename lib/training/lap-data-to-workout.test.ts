import assert from "node:assert/strict";
import test from "node:test";
import type { DerivedLap } from "./lap-converter";
import { assignLapsForTest } from "./lap-data-to-workout";

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

test("Intervals: distance fallback when lap count differs from segment rows", () => {
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

test("Tempo: distance fallback when lap count differs from segment rows", () => {
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

test("Easy: auto mile-chunk when lap totals match prescription", () => {
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
  const derived = [lap(0), lap(1), lap(2), lap(3), lap(4), lap(5)];
  const result = assignLapsForTest(derived, segments, "Easy");
  assert.ok(result);
  assert.equal(result.mode, "auto");
  assert.equal(result.bySegment.get("m")!.length, 4);
});
