import assert from "node:assert/strict";
import test from "node:test";
import {
  parseWorkoutSegmentsCsv,
  titleAfterSegmentCsvImport,
  WORKOUT_SEGMENT_CSV_TEMPLATE,
} from "@/lib/workout/parse-workout-segments-csv";
import { apiSegmentsToSlots } from "@/lib/training/create-workout-slot-map";
import { formatPaceTargetRangeForDisplay } from "@/lib/workout-generator/pace-calculator";

test("CSV recovery row with an easy pace becomes recovery between reps", () => {
  const csv = `title,durationType,durationValue,pace,repeatCount
Warmup,DISTANCE,2,8:30,
Work,DISTANCE,5,7:00,3
Recovery,DISTANCE,0.5,9:00,
Cooldown,DISTANCE,1.5,9:00,`;
  const parsed = parseWorkoutSegmentsCsv(csv);
  assert.equal(parsed.error, undefined);
  const slots = apiSegmentsToSlots(parsed.steps);
  assert.equal(slots.warmup?.durationValue, 2);
  assert.equal(slots.cooldown?.durationValue, 1.5);
  assert.equal(slots.mainSegments.length, 1);
  assert.equal(slots.mainSegments[0]?.repeatCount, 3);
  assert.equal(slots.mainSegments[0]?.durationValue, 5);
  assert.equal(slots.mainSegments[0]?.recoveryDurationType, "DISTANCE");
  assert.equal(slots.mainSegments[0]?.recoveryDurationValue, 0.5);
});

test("CSV recovery columns on the work row become recovery between reps", () => {
  const csv = `title,durationType,durationValue,pace,repeatCount,recoveryDurationType,recoveryDurationValue
Warmup,DISTANCE,2,8:30,,,,
Work,DISTANCE,5,7:00,3,DISTANCE,0.5
Cooldown,DISTANCE,1.5,9:00,,,,`;
  const parsed = parseWorkoutSegmentsCsv(csv);
  assert.equal(parsed.error, undefined);
  const slots = apiSegmentsToSlots(parsed.steps);
  assert.equal(slots.warmup?.durationValue, 2);
  assert.equal(slots.cooldown?.durationValue, 1.5);
  assert.equal(slots.mainSegments.length, 1);
  assert.equal(slots.mainSegments[0]?.repeatCount, 3);
  assert.equal(slots.mainSegments[0]?.recoveryDurationType, "DISTANCE");
  assert.equal(slots.mainSegments[0]?.recoveryDurationValue, 0.5);
});

test("CSV paceMin and paceMax store the faster edge first", () => {
  const csv = `title,durationType,durationValue,paceMin,paceMax,repeatCount
Work,DISTANCE,5,6:57,6:52,3`;
  const parsed = parseWorkoutSegmentsCsv(csv);
  assert.equal(parsed.error, undefined);
  const pace = parsed.steps[0]?.targets?.[0];
  assert.ok(pace);
  assert.equal(
    formatPaceTargetRangeForDisplay(pace.valueLow!, pace.valueHigh!),
    "6:52–6:57 /mi"
  );
});

test("CSV paceMin alone stays a single pace", () => {
  const csv = `title,durationType,durationValue,paceMin,paceMax
Work,DISTANCE,5,6:55,`;
  const parsed = parseWorkoutSegmentsCsv(csv);
  assert.equal(parsed.error, undefined);
  const pace = parsed.steps[0]?.targets?.[0];
  assert.ok(pace);
  assert.equal(formatPaceTargetRangeForDisplay(pace.valueLow!, pace.valueHigh!), "6:55 /mi");
});

test("CSV import does not rename an empty workout", () => {
  assert.equal(titleAfterSegmentCsvImport(""), "");
  assert.equal(titleAfterSegmentCsvImport("  Saturday MP  "), "Saturday MP");
  assert.equal(WORKOUT_SEGMENT_CSV_TEMPLATE.includes("paceMin"), true);
  assert.equal(WORKOUT_SEGMENT_CSV_TEMPLATE.includes(",pace,"), false);
});

test("CSV Easy row stays its own segment", () => {
  const csv = `title,durationType,durationValue,pace,repeatCount
Warmup,DISTANCE,2,8:30,
Work,TIME,3,7:25,8
Easy,TIME,3,8:25,
Cooldown,DISTANCE,1.5,9:00,`;
  const parsed = parseWorkoutSegmentsCsv(csv);
  assert.equal(parsed.error, undefined);
  const slots = apiSegmentsToSlots(parsed.steps);
  assert.equal(slots.mainSegments.length, 2);
  assert.equal(slots.mainSegments[0]?.repeatCount, 8);
  assert.equal(slots.mainSegments[0]?.recoveryDurationType ?? null, null);
  assert.equal(slots.mainSegments[1]?.durationValue, 3);
});
