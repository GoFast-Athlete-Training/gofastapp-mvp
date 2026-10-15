import assert from "node:assert/strict";
import test from "node:test";
import {
  tryParsePastedWorkoutText,
  materializeParsedPasteWorkoutSteps,
} from "./parse-pasted-workout";

const YORKTOWN_NOTE = `Track Crew, please join us dark and early tomorrow for Tempo Thursday at Yorktown. We'll be running 2 x 20 minutes at tempo pace followed by some sharpening intervals (2x400m at 5k pace). If you haven't been out to the track in a few weeks it's a great time to come back and rejoin the pack as we run around the oval waiting for the sun to rise. See you at 0545 for warmups!`;

test("tryParsePastedWorkoutText parses Yorktown tempo + 400m note", () => {
  const result = tryParsePastedWorkoutText(YORKTOWN_NOTE, "Tempo");
  assert.ok(result);
  assert.equal(result.segments.length, 2);

  const tempo = result.segments[0];
  assert.equal(tempo.durationType, "TIME");
  assert.equal(tempo.durationValue, 20);
  assert.equal(tempo.repeatCount, 2);
  assert.equal(tempo.paceOffsetSecPerMile, 15);
  assert.equal(tempo.title, "Tempo");

  const intervals = result.segments[1];
  assert.equal(intervals.durationType, "DISTANCE");
  assert.ok(Math.abs(intervals.durationValue - 0.249) < 0.002);
  assert.equal(intervals.repeatCount, 2);
  assert.equal(intervals.paceOffsetSecPerMile, 0);
});

test("tryParsePastedWorkoutText returns null when no repeat prescriptions", () => {
  assert.equal(tryParsePastedWorkoutText("easy 6 miles around the park"), null);
});

test("materializeParsedPasteWorkoutSteps resolves pace from athlete 5K", () => {
  const parsed = tryParsePastedWorkoutText("2 x 20 minutes at tempo", "Tempo");
  assert.ok(parsed);
  const steps = materializeParsedPasteWorkoutSteps(parsed, "6:00");
  assert.equal(steps[0].targets?.[0]?.type, "PACE");
  assert.equal(steps[0].durationType, "TIME");
  assert.equal(steps[0].durationValue, 20);
});
