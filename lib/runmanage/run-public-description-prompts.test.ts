import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPublicDescriptionSystemPrompt,
  containsBannedFirstPerson,
  FIRST_PERSON_BAN,
  TRACK_PUBLIC_DESCRIPTION_SYSTEM,
  trackDescriptionNeedsRetry,
  workoutSessionHasMultiplePieces,
} from "./run-public-description-prompts";

test("track prompt requires third person, bans first person, and line-per-piece format", () => {
  const prompt = buildPublicDescriptionSystemPrompt({ isShakeout: false, track: true });
  assert.equal(prompt, TRACK_PUBLIC_DESCRIPTION_SYSTEM);
  assert.match(prompt, /Third person/);
  assert.match(prompt, new RegExp(FIRST_PERSON_BAN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 40)));
  assert.match(prompt, /One line per distinct piece/);
  assert.match(prompt, /Do not merge the workout into one paragraph/);
});

test("road and shakeout prompts include first-person ban", () => {
  const road = buildPublicDescriptionSystemPrompt({ isShakeout: false, track: false });
  const shakeout = buildPublicDescriptionSystemPrompt({ isShakeout: true, track: false });
  assert.match(road, /Never use first or second person/);
  assert.match(shakeout, /Never use first or second person/);
});

test("containsBannedFirstPerson flags we/your marketing copy", () => {
  assert.equal(
    containsBannedFirstPerson(
      "Join us this Tuesday as we kick things off with a warmup.",
    ),
    true,
  );
  assert.equal(
    containsBannedFirstPerson("Northeast Track Club. Tuesday at Eastern Senior High School."),
    false,
  );
});

test("workoutSessionHasMultiplePieces detects multi-segment workout blobs", () => {
  const sample =
    "1-mile warmup, followed by 2–3 intervals of 1600m at 10K–5K pace, 1000m at 5K pace, 600m at 5K pace, 1-mile cooldown";
  assert.equal(workoutSessionHasMultiplePieces(sample), true);
  assert.equal(workoutSessionHasMultiplePieces("Easy 3 miles"), false);
});

test("trackDescriptionNeedsRetry for paragraph with first person", () => {
  const bad =
    "Join Northeast Track Club this Tuesday! We'll kick things off with a 1-mile warmup, then intervals.";
  const workout = "warmup 1 mile, 2-3 x 1600m, 1000m, 600m, cooldown 1 mile";
  assert.equal(trackDescriptionNeedsRetry(bad, workout), true);
});

test("trackDescriptionNeedsRetry accepts line-based objective copy", () => {
  const good = `Northeast Track Club. Tuesday at Eastern Senior High School. All paces welcome.
Warmup: 1 mile
2–3 × 1600m between 10K and 5K pace
1000m at 5K pace
600m at 5K pace
Cooldown: 1 mile`;
  const workout = "1-mile warmup, 2–3 intervals of 1600m, 1000m, 600m, cooldown";
  assert.equal(trackDescriptionNeedsRetry(good, workout), false);
});
