import assert from "node:assert/strict";
import test from "node:test";
import { catalogueWarmupWorkCooldownMiles } from "./catalogue-mile-estimate";

const base = {
  workoutType: "Intervals" as const,
  segmentPaceDist: null,
  warmupMiles: null,
  cooldownMiles: null,
  workBaseMiles: null,
  workBaseReps: null,
  workBaseRepMeters: null,
};

test("catalogueWarmupWorkCooldownMiles sums ladder reps with bookends", () => {
  const miles = catalogueWarmupWorkCooldownMiles({
    ...base,
    warmupMiles: 1.5,
    cooldownMiles: 1,
    segmentPaceDist: [
      { distanceMeters: 400, reps: 8, paceOffsetSecPerMile: -15 },
    ],
  });
  assert.equal(miles, 4.5);
});

test("catalogueWarmupWorkCooldownMiles repeats a block", () => {
  const miles = catalogueWarmupWorkCooldownMiles({
    ...base,
    warmupMiles: 1,
    cooldownMiles: 1,
    segmentPaceDist: {
      layout: "blockRepeat",
      segments: [
        { distanceMeters: 400, paceOffsetSecPerMile: -20 },
        { distanceMeters: 400, paceOffsetSecPerMile: 40 },
      ],
      repeatCount: 6,
    },
  });
  assert.equal(miles, 5);
});

test("catalogueWarmupWorkCooldownMiles uses legacy reps when segments are empty", () => {
  const miles = catalogueWarmupWorkCooldownMiles({
    ...base,
    warmupMiles: 1.5,
    cooldownMiles: 1.5,
    workBaseReps: 6,
    workBaseRepMeters: 800,
  });
  assert.equal(miles, 6);
});
