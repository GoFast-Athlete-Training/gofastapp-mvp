import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeFourHunMSwPaceFrom400m,
  resolveSwimPaceTargets,
  formatSwimPaceNote,
} from "@/lib/training/swim-pace-resolver";

test("normalizeFourHunMSwPaceFrom400m divides total 400m time by 4", () => {
  assert.equal(normalizeFourHunMSwPaceFrom400m(360), 90);
  assert.equal(normalizeFourHunMSwPaceFrom400m(400), 100);
});

test("resolveSwimPaceTargets applies default offsets by workout type", () => {
  const endurance = resolveSwimPaceTargets({
    fourHunMSwPace: 100,
    workoutType: "EnduranceSwim",
  });
  assert.equal(endurance.paceSecPer100mLow, 106);
  assert.equal(endurance.paceSecPer100mHigh, 115);
  assert.ok(endurance.paceNote.includes("100m"));

  const power = resolveSwimPaceTargets({
    fourHunMSwPace: 100,
    workoutType: "PowerSwim",
  });
  assert.equal(power.paceSecPer100mLow, 90);
  assert.equal(power.paceSecPer100mHigh, 96);
});

test("resolveSwimPaceTargets prefers catalogue offset when provided", () => {
  const out = resolveSwimPaceTargets({
    fourHunMSwPace: 95,
    workoutType: "ThresholdSwim",
    catalogueOffsetSecPer100m: 3,
  });
  assert.equal(out.paceSecPer100mLow, 98);
  assert.equal(out.paceSecPer100mHigh, 98);
});

test("formatSwimPaceNote renders M:SS/100m", () => {
  assert.equal(formatSwimPaceNote(95), "1:35/100m");
  assert.equal(formatSwimPaceNote(60), "1:00/100m");
});
