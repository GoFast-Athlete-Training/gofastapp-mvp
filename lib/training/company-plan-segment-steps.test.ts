import assert from "node:assert/strict";
import test from "node:test";
import { milesFromSegmentSteps, parseStaffSegmentWrite } from "./company-plan-segment-steps";

test("milesFromSegmentSteps adds work reps and the recoveries between them", () => {
  const miles = milesFromSegmentSteps([
    { stepOrder: 1, title: "Warmup", durationType: "DISTANCE", durationValue: 2 },
    {
      stepOrder: 2,
      title: "Work",
      durationType: "DISTANCE",
      durationValue: 0.25,
      repeatCount: 8,
      recoveryDurationType: "DISTANCE",
      recoveryDurationValue: 0.25,
    },
    { stepOrder: 3, title: "Cooldown", durationType: "DISTANCE", durationValue: 1 },
  ]);
  assert.equal(miles, 6.8);
});

test("parseStaffSegmentWrite rejects a race type and keeps pace bands", () => {
  const rejected = parseStaffSegmentWrite({
    title: "Race day",
    workoutType: "Race",
    steps: [{ title: "Race", durationType: "DISTANCE", durationValue: 3.1 }],
  });
  assert.equal(rejected.ok, false);

  const parsed = parseStaffSegmentWrite({
    title: "Track",
    workoutType: "Intervals",
    steps: [
      {
        title: "400",
        durationType: "DISTANCE",
        durationValue: 0.25,
        repeatCount: 8,
        targets: [{ type: "PACE", valueLow: 200, valueHigh: 180 }],
      },
    ],
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.steps[0]?.targets?.[0]?.valueLow, 180);
  assert.equal(parsed.steps[0]?.targets?.[0]?.valueHigh, 200);
});
