/**
 * Smoke: profile fiveKPace string → sec/mile → training paces → template → API segments.
 * Mirrors the happy path inside POST /api/workouts/gofast-generate (no DB, no auth).
 *
 * Run: npm run smoke:fivek-pace
 */
import {
  parsePaceToSecondsPerMile,
  getTrainingPaces,
} from "../lib/workout-generator/pace-calculator";
import {
  getTemplateSegments,
  descriptorsToApiSegments,
} from "../lib/workout-generator/templates";

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

const sec = parsePaceToSecondsPerMile("7:30/mile");
assert(sec === 7 * 60 + 30, "parse 7:30/mile");

let threw = false;
try {
  parsePaceToSecondsPerMile("not-a-pace");
} catch {
  threw = true;
}
assert(threw, "invalid pace string throws (same as gofast-generate catch path)");

const paces = getTrainingPaces(sec);
assert(paces.goalSecondsPerMile === sec, "goal pace round-trip");
assert(paces.easy > 0 && paces.tempo > 0, "derived zones positive");

const descriptors = getTemplateSegments("Easy", 6, paces);
const segments = descriptorsToApiSegments(descriptors, paces);
assert(segments.length >= 3, "Easy template has warmup / main / cooldown");
assert(
  segments.every((s, i) => s.stepOrder === i + 1),
  "stepOrder 1-based"
);
const paceTargets = segments.filter((s) =>
  s.targets?.some((t) => t.type === "PACE")
);
assert(
  paceTargets.length === segments.length,
  "each segment has PACE targets for Garmin/API"
);

console.log(
  "OK smoke:fivek-pace — parse → getTrainingPaces → Easy 6mi →",
  segments.length,
  "segments"
);
