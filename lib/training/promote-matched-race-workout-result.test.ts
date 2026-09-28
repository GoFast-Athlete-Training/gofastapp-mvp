import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizedRaceTitleKey,
  raceTitlesAlign,
} from "./promote-matched-race-workout-result";

test("normalizedRaceTitleKey strips GF week and weekday", () => {
  assert.equal(
    normalizedRaceTitleKey("GF W5: Boulderthon Marathon (Sun)"),
    "boulderthon marathon"
  );
});

test("raceTitlesAlign matches workout title to race name", () => {
  assert.equal(
    raceTitlesAlign("Boulderthon Marathon", "Boulderthon Marathon"),
    true
  );
  assert.equal(
    raceTitlesAlign("Boulderthon Marathon", "GF W5: Boulderthon Marathon (Sun)"),
    true
  );
  assert.equal(
    raceTitlesAlign(
      "Boulderthon Marathon",
      "Boulder - GF W5: Boulderthon Marathon (Sun)"
    ),
    true
  );
});

test("raceTitlesAlign handles Race em dash prefix", () => {
  assert.equal(
    raceTitlesAlign("Boulderthon Marathon", "Race — Boulderthon Marathon"),
    true
  );
});
