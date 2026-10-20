import assert from "node:assert/strict";
import test from "node:test";
import { segmentsFromWeekCsvPaceNote } from "@/lib/training/plan-week-csv-segments";

test("MCM tempo pace column → 3 segments with explicit tempo pace targets", () => {
  const steps = segmentsFromWeekCsvPaceNote({
    paceNote:
      '2 mi warm-up easy; 2 mi tempo @ 6:45/mi; 2 mi cool-down easy',
    workoutType: "Tempo",
    miles: 6,
    workoutName: "Controlled Tempo",
    fiveKPace: "6:30",
  });
  assert.ok(steps);
  assert.equal(steps!.length, 3);
  assert.equal(steps![0]!.title, "Warm-up");
  assert.equal(steps![1]!.title, "Tempo");
  assert.equal(steps![1]!.durationValue, 2);
  const targets = steps![1]!.targets;
  assert.ok(Array.isArray(targets) && targets.length > 0);
  const pace = targets![0] as { type?: string; valueLow?: number; valueHigh?: number };
  assert.equal(pace.type, "PACE");
});

test("space-separated blocks: easy work cool-down titles and 2mi each", () => {
  const steps = segmentsFromWeekCsvPaceNote({
    paceNote: "2 miles easy 2 miles tempo @ 6:45/mi 2 miles cool down",
    workoutType: "Tempo",
    miles: 6,
    workoutName: "Controlled Tempo",
    fiveKPace: "6:30",
  });
  assert.ok(steps);
  assert.equal(steps!.length, 3);
  assert.equal(steps![0]!.title, "Easy");
  assert.equal(steps![1]!.title, "Tempo");
  assert.equal(steps![2]!.title, "Cool-down");
  assert.equal(steps![0]!.durationValue, 2);
  assert.equal(steps![2]!.durationValue, 2);
});

test("single easy pace → one distance step", () => {
  const steps = segmentsFromWeekCsvPaceNote({
    paceNote: "8:00/mi",
    workoutType: "Easy",
    miles: 3,
    workoutName: "Ballston Runaways",
    fiveKPace: "6:30",
  });
  assert.ok(steps);
  assert.equal(steps!.length, 1);
  assert.equal(steps![0]!.durationValue, 3);
});
