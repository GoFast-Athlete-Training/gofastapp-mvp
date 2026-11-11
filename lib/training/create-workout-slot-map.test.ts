import assert from "node:assert/strict";
import test from "node:test";
import { parsedPasteToWorkoutSteps } from "@/lib/training/paste-workout-pipeline";
import { tryParsePastedWorkoutText } from "@/lib/training/parse-pasted-workout";
import {
  apiSegmentsToSlots,
  materializeMainSlotRows,
} from "@/lib/training/create-workout-slot-map";
import {
  collapseFlatSegmentsForEditor,
  expandSegmentsForGarminPush,
} from "@/lib/training/segment-summary";
import { assembleGarminWorkout } from "@/lib/garmin-workouts/garmin-training-service";

const MODIFIED_FARTLEK_NOTE = `**Workout Name:** Modified Fartlek – 3 Minutes On / 3 Minutes Off

**Warm-Up:** 2 miles easy

**Main Set:** 8 repetitions of:
- 3 minutes ON at 7:25/mile
- 3 minutes OFF at 8:25/mile

**Cool-Down:** 1–2 miles easy`;

test("apiSegmentsToSlots groups timed ON/OFF fartlek as one interval block", () => {
  const parsed = tryParsePastedWorkoutText(MODIFIED_FARTLEK_NOTE, "Intervals");
  assert.ok(parsed);
  const steps = parsedPasteToWorkoutSteps(parsed, "6:14");
  const slots = apiSegmentsToSlots(steps);
  assert.equal(slots.mainSegments.length, 1);
  const block = slots.mainSegments[0]?.intervalBlock;
  assert.ok(block);
  assert.equal(block.repeatCount, 8);
  assert.equal(block.legs.length, 2);
  assert.equal(block.legs[0]?.durationValue, 3);
  assert.equal(block.legs[1]?.durationValue, 3);
});

test("materializeMainSlotRows matches collapse/Garmin canon for fartlek block", () => {
  const parsed = tryParsePastedWorkoutText("8x (3 min ON at 7:25, 3 min OFF at 8:25)", "Intervals");
  assert.ok(parsed);
  const steps = parsedPasteToWorkoutSteps(parsed, "6:14");
  const { mainSegments } = apiSegmentsToSlots(steps);
  assert.equal(mainSegments.length, 1);
  const rows = materializeMainSlotRows(mainSegments[0]!, "Work");
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.repeatCount, 8);
  assert.equal(rows[1]?.title, "Recovery");

  const apiRows = rows.map((r, i) => ({
    id: `s-${i}`,
    stepOrder: i + 1,
    title: r.title,
    durationType: r.durationType,
    durationValue: r.durationValue,
    repeatCount: r.repeatCount ?? null,
    targets:
      r.paceValueLow != null
        ? [{ type: "PACE", valueLow: r.paceValueLow, valueHigh: r.paceValueHigh ?? r.paceValueLow }]
        : undefined,
  }));

  const collapsed = collapseFlatSegmentsForEditor(apiRows);
  const garminRows = expandSegmentsForGarminPush(
    collapsed.map((s, i) => ({
      ...s,
      id: `g-${i}`,
      workoutId: "w1",
      paceTargetEncodingVersion: 2 as const,
    }))
  );

  const workout = assembleGarminWorkout({
    id: "w1",
    title: "Fartlek",
    workoutType: "Intervals",
    segments: garminRows.map((s) => ({
      ...s,
      workoutId: "w1",
      paceTargetEncodingVersion: 2,
    })),
  });

  const repeat = workout.steps.find((st) => st.type === "WorkoutRepeatStep");
  assert.ok(repeat);
  assert.equal(repeat.repeatValue, 8);
  assert.equal(repeat.steps?.length, 2);
});
