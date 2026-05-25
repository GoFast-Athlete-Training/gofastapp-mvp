/**
 * Smoke checks for training hydrate projection + light adaptive evaluation helpers.
 * Run: npx tsx scripts/verify-training-hydrate-mvp.ts
 */

import assert from "node:assert/strict";
import {
  differenceToGoal,
  projectRaceFromFiveKSecPerMile,
  parseGoalTimeToSeconds,
} from "../lib/training/race-projection";

const MILES_MARATHON = 26.21875;

const projection = projectRaceFromFiveKSecPerMile(480, MILES_MARATHON);
assert.ok(projection);
assert.ok(projection!.projectedFinishSec > 0);
assert.ok(projection!.projectedPaceSecPerMile > 480);

const goalFinishSec = parseGoalTimeToSeconds("3:30:00");
assert.ok(goalFinishSec);

const diff = differenceToGoal({
  goalFinishSec,
  projectedFinishSec: projection!.projectedFinishSec,
  goalPaceSecPerMile: 480,
  projectedPaceSecPerMile: projection!.projectedPaceSecPerMile,
});
assert.ok(diff.finishDeltaLabel);
assert.ok(typeof diff.onTrack === "boolean" || diff.onTrack === null);

console.log("verify-training-hydrate-mvp: ok");
