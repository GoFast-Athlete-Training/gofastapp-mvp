import assert from "node:assert/strict";
import test from "node:test";
import {
  tryParsePastedWorkoutText,
  materializeParsedPasteWorkoutSteps,
  inferRepDistanceMiles,
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

test("inferRepDistanceMiles treats 2000 without unit as meters", () => {
  const mi = inferRepDistanceMiles(2000, undefined, "4 x 2000 at tempo");
  assert.ok(mi != null);
  assert.ok(Math.abs(mi - 1.243) < 0.01);
});

test("parses 4 x 2000 without unit suffix", () => {
  const parsed = tryParsePastedWorkoutText("4 x 2000 at tempo pace", "Tempo");
  assert.ok(parsed);
  assert.equal(parsed.segments[0].repeatCount, 4);
  assert.ok(Math.abs(parsed.segments[0].durationValue - 1.243) < 0.01);
});

test("parses 3 x 2k shorthand as kilometers", () => {
  const parsed = tryParsePastedWorkoutText("3 x 2k at 5k pace", "Intervals");
  assert.ok(parsed);
  assert.equal(parsed.segments[0].repeatCount, 3);
  assert.ok(Math.abs(parsed.segments[0].durationValue - 1.243) < 0.02);
});

test("parses 800m repeats with between-rep recovery and explicit pace band", () => {
  const note =
    "800m repeats 4 x 800m at 7:00–7:30/mile pace (3:29–3:44 per 800m), with 400m easy jog recovery between repeats";
  const parsed = tryParsePastedWorkoutText(note, "Intervals");
  assert.ok(parsed);
  assert.equal(parsed.segments.length, 1);
  const seg = parsed.segments[0];
  assert.equal(seg.repeatCount, 4);
  assert.equal(seg.recoveryDurationType, "DISTANCE");
  assert.ok(Math.abs((seg.recoveryDurationValue ?? 0) - 0.249) < 0.002);
  const steps = materializeParsedPasteWorkoutSteps(parsed, null);
  assert.equal(steps[0].recoveryDurationType, "DISTANCE");
  assert.ok(steps[0].targets?.[0]?.type === "PACE");
});
