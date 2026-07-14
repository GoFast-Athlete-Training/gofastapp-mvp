import assert from "node:assert/strict";
import test from "node:test";
import {
  computeRecommendedWeeklyMeters,
  deriveLongSwimMeters,
  normalizeSwimPresetVolume,
  parseWeeklyProgressionPattern,
  taperWeeklyMeters,
  validateTargetWeeklyMeters,
  weeklyMetersForCycleWeek,
} from "@/lib/training/swim-plan-preset";
import { buildSwimPresetSlug, parseSwimPresetFromBody } from "@/lib/training/swim-preset-api";

test("computeRecommendedWeeklyMeters uses goal × multiplier", () => {
  assert.equal(computeRecommendedWeeklyMeters(1900, 4), 7600);
  assert.equal(computeRecommendedWeeklyMeters(1500, 3.5), 5250);
});

test("normalizeSwimPresetVolume derives recommendation from goal when unset", () => {
  const out = normalizeSwimPresetVolume({
    goalSwimDistanceMeters: 2000,
    recommendationMultiplier: 4,
    minWeeklyMeters: 5000,
    maxWeeklyMeters: 12000,
  });
  assert.equal(out.recommendedWeeklyMeters, 8000);
  assert.equal(out.minWeeklyMeters, 5000);
  assert.equal(out.maxWeeklyMeters, 12000);
  assert.equal(out.warnings.length, 0);
});

test("normalizeSwimPresetVolume warns when explicit recommendation diverges from computed", () => {
  const out = normalizeSwimPresetVolume({
    goalSwimDistanceMeters: 2000,
    recommendationMultiplier: 4,
    recommendedWeeklyMeters: 9000,
    minWeeklyMeters: 4000,
  });
  assert.equal(out.recommendedWeeklyMeters, 9000);
  assert.ok(out.warnings.some((w) => w.includes("differs from goal")));
});

test("normalizeSwimPresetVolume clears invalid max below min", () => {
  const out = normalizeSwimPresetVolume({
    minWeeklyMeters: 6000,
    maxWeeklyMeters: 4000,
  });
  assert.equal(out.maxWeeklyMeters, null);
  assert.ok(out.warnings.some((w) => w.includes("maxWeeklyMeters")));
});

test("validateTargetWeeklyMeters enforces preset bounds", () => {
  assert.deepEqual(validateTargetWeeklyMeters(7000, 5000, 10000), { ok: true });
  assert.equal(validateTargetWeeklyMeters(4000, 5000, 10000).ok, false);
  assert.equal(validateTargetWeeklyMeters(11000, 5000, 10000).ok, false);
});

test("deriveLongSwimMeters applies share and clamps", () => {
  assert.equal(
    deriveLongSwimMeters({
      weeklyMeters: 10000,
      longSwimShareOfWeek: 0.25,
      longSwimMinMeters: 2000,
      longSwimMaxMeters: 3000,
    }),
    2500
  );
  assert.equal(
    deriveLongSwimMeters({
      weeklyMeters: 5000,
      longSwimShareOfWeek: 0.1,
      longSwimMinMeters: 1500,
    }),
    1500
  );
});

test("weekly progression and taper adjust meters", () => {
  const pattern = parseWeeklyProgressionPattern({
    weekMultipliers: [1, 1.1, 0.9],
  });
  assert.ok(pattern);
  assert.equal(weeklyMetersForCycleWeek(6000, 1, pattern), 6600);
  assert.equal(taperWeeklyMeters(8000, 0.5), 4000);
});

test("parseSwimPresetFromBody requires title on create", () => {
  const bad = parseSwimPresetFromBody({ goalSwimDistanceMeters: 1900 });
  assert.equal(bad.ok, false);
  const ok = parseSwimPresetFromBody({
    title: "Olympic Swim Base",
    goalSwimDistanceMeters: 1900,
    workoutStructure: { weeklyCounts: { EnduranceSwim: 2, LongSwim: 1 } },
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.data.title, "Olympic Swim Base");
  }
});

test("buildSwimPresetSlug prefixes swim-", () => {
  assert.equal(buildSwimPresetSlug("Olympic Base"), "swim-olympic-base");
  assert.equal(buildSwimPresetSlug("Olympic Base", "custom-slug"), "swim-custom-slug");
});
