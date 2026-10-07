import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPublicDescriptionSystemPrompt,
  CLUB_VOICE_BAN,
  containsBannedFirstPerson,
  TRACK_PUBLIC_DESCRIPTION_SYSTEM,
  trackDescriptionNeedsRetry,
  trackIntroIsTooLiteral,
  workoutSessionHasMultiplePieces,
} from "./run-public-description-prompts";

test("track prompt invites by club name and still splits workout lines", () => {
  const prompt = buildPublicDescriptionSystemPrompt({ isShakeout: false, track: true });
  assert.equal(prompt, TRACK_PUBLIC_DESCRIPTION_SYSTEM);
  assert.match(prompt, /inviting sentence that names the club/);
  assert.match(prompt, /camaraderie/);
  assert.match(prompt, /one line per distinct workout piece/);
  assert.match(prompt, /No @ shorthand/);
  assert.match(prompt, new RegExp(CLUB_VOICE_BAN.slice(0, 24)));
});

test("road and shakeout prompts include first-person ban", () => {
  const road = buildPublicDescriptionSystemPrompt({ isShakeout: false, track: false });
  const shakeout = buildPublicDescriptionSystemPrompt({ isShakeout: true, track: false });
  assert.match(road, /Never use first or second person/);
  assert.match(shakeout, /Never use first or second person/);
});

test("containsBannedFirstPerson flags club voice and allows a join invite", () => {
  assert.equal(
    containsBannedFirstPerson(
      "Join us this Tuesday as we kick things off with a warmup.",
    ),
    true,
  );
  assert.equal(
    containsBannedFirstPerson(
      "Join Northeast Track Club this Tuesday for a night of track and camaraderie.",
    ),
    false,
  );
});

test("trackIntroIsTooLiteral flags a date-and-place fact line", () => {
  assert.equal(
    trackIntroIsTooLiteral(
      "Northeast Track Club on October 6 at Eastern Senior High School. All paces welcome.",
    ),
    true,
  );
  assert.equal(
    trackIntroIsTooLiteral(
      "Join Northeast Track Club this Tuesday at Eastern Senior High School for a night of track and camaraderie.",
    ),
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

test("trackDescriptionNeedsRetry rejects a dry fact opener", () => {
  const dry = `Northeast Track Club on October 6 at Eastern Senior High School. All paces welcome.
Warmup: 1 mile
2–3 × 1600m @ 10K → 5K
Cooldown: 1 mile`;
  const workout = "1-mile warmup, 2–3 intervals of 1600m, cooldown";
  assert.equal(trackDescriptionNeedsRetry(dry, workout), true);
});

test("trackDescriptionNeedsRetry accepts an invite plus workout lines", () => {
  const good = `Join Northeast Track Club this Tuesday at Eastern Senior High School for a night of track and camaraderie. All paces welcome.
Warmup: 1 mile
2–3 × 1600m between 10K and 5K pace
1000m at 5K pace
600m at 5K pace
Cooldown: 1 mile`;
  const workout = "1-mile warmup, 2–3 intervals of 1600m, 1000m, 600m, cooldown";
  assert.equal(trackDescriptionNeedsRetry(good, workout), false);
});
