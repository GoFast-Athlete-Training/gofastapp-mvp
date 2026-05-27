import assert from "node:assert/strict";
import test from "node:test";
import {
  assertAllPositionsHaveCatalogue,
  assertScheduleEasyDaysHaveCatalogue,
  EASY_CONFIG_REQUIRES_CATALOGUE,
  EASY_RUN_NOT_CONFIGURED,
  PRESET_EASY_NOT_CONFIGURED,
  rotationMissingCatalogueWorkout,
  validateAttachedPresetConfig,
  validatePresetRotationConfigs,
} from "./run-type-config-validation";

test("rotationMissingCatalogueWorkout detects empty and all-null rotations", () => {
  assert.equal(rotationMissingCatalogueWorkout([]), true);
  assert.equal(
    rotationMissingCatalogueWorkout([{ catalogueWorkoutId: null }]),
    true
  );
  assert.equal(
    rotationMissingCatalogueWorkout([{ catalogueWorkoutId: "abc" }]),
    false
  );
});

test("assertAllPositionsHaveCatalogue rejects empty slots", () => {
  const result = assertAllPositionsHaveCatalogue(
    [{ cyclePosition: 0, distributionWeight: 1, catalogueWorkoutId: null }],
    "Easy config"
  );
  assert.equal(result.ok, false);
});

test("validatePresetRotationConfigs rejects incomplete easy config", () => {
  const result = validatePresetRotationConfigs({
    easyConfig: {
      name: "Easy Run",
      positions: [{ catalogueWorkoutId: null }],
    },
    longRunConfig: {
      name: "Long",
      positions: [{ catalogueWorkoutId: "lr-1" }],
    },
    tempoConfig: {
      name: "Tempo",
      positions: [{ catalogueWorkoutId: "t-1" }],
    },
    intervalsConfig: {
      name: "Intervals",
      positions: [{ catalogueWorkoutId: "i-1" }],
    },
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, new RegExp(PRESET_EASY_NOT_CONFIGURED));
  }
});

test("validateAttachedPresetConfig passes when every slot has a catalogue id", () => {
  const result = validateAttachedPresetConfig({
    config: {
      name: "Easy Run",
      positions: [{ catalogueWorkoutId: "easy-1" }],
    },
    configLabel: "Easy config",
    missingMessage: PRESET_EASY_NOT_CONFIGURED,
  });
  assert.equal(result.ok, true);
});

test("assertScheduleEasyDaysHaveCatalogue throws for missing catalogue ids", () => {
  assert.throws(
    () =>
      assertScheduleEasyDaysHaveCatalogue([
        {
          days: [{ workoutType: "Easy", catalogueWorkoutId: null }],
        },
      ]),
    (err: unknown) => err instanceof Error && err.message === EASY_RUN_NOT_CONFIGURED
  );
});

test("EASY_CONFIG_REQUIRES_CATALOGUE matches product copy", () => {
  assert.equal(
    EASY_CONFIG_REQUIRES_CATALOGUE,
    "Easy config requires a catalogue workout before saving."
  );
});
