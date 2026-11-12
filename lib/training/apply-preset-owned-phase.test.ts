import assert from "node:assert/strict";
import test from "node:test";
import { applyPresetOwnedPhase } from "@/lib/training/apply-preset-owned-phase";
import type { TrainingManagePresetForGenerate } from "@/lib/training/fetch-training-manage-preset-for-generate";

function loadedPreset(): TrainingManagePresetForGenerate {
  return {
    id: "preset",
    slug: "marathon",
    title: "Marathon",
    minWeeklyMiles: 40,
    maxWeeklyMiles: 55,
    publicDescription: null,
    targetDistanceLabel: "Marathon",
    tempoIdealDow: 2,
    intervalIdealDow: 4,
    longRunDefaultDow: 6,
    coachPlanOverview: null,
    workoutStructure: null,
    easyRunConfig: null,
    baseBuild: null,
    build: {
      startLongRunMiles: 10,
      peakLongRunMiles: 16,
      peakWeeklyMiles: 50,
      longRunCutback: 0.2,
      longRunConfig: null,
      easyConfig: null,
      tempoConfig: null,
      intervalsConfig: null,
    },
    taper: null,
    raceWeek: {
      title: "Race week",
      slots: [
        {
          offsetFromRace: -2,
          runName: "Shakeout",
          type: "shakeout-easy",
          catalogueWorkoutId: null,
          prescribedMiles: null,
          shakeoutRunConfigId: null,
        },
      ],
    },
  };
}

test("phase miles set the base band and taper caps and leave race-week days alone", () => {
  const loaded = applyPresetOwnedPhase(loadedPreset(), {
    entryLongRunMiles: 12,
    peakLongRunMiles: 20,
    baseStartLongRunMiles: 8,
    baseEndLongRunMiles: 12,
    baseEndWeeklyMiles: null,
    baseWeeklyMinMiles: 30,
    baseWeeklyMaxMiles: 40,
    longRunCutback: 0.25,
    taperWeek1TotalMiles: 40,
    taperWeek1LongRunMiles: 12,
    taperWeek2TotalMiles: 30,
    taperWeek2LongRunMiles: 8,
    raceWeekDayMiles: null,
    raceWeekMiles: 18,
    baseBuildPhase: null,
    buildToPeakPhase: null,
  });

  assert.equal(loaded.build?.startLongRunMiles, 12);
  assert.equal(loaded.build?.peakLongRunMiles, 20);
  assert.equal(loaded.build?.longRunCutback, 0.2);
  assert.equal(loaded.baseBuild?.startLongRunMiles, 8);
  assert.equal(loaded.baseBuild?.peakLongRunMiles, 12);
  assert.equal(loaded.baseBuild?.weeklyMinMiles, 30);
  assert.equal(loaded.baseBuild?.peakWeeklyMiles, 40);
  assert.equal(loaded.taper?.weeks.find((week) => week.weekIndex === 1)?.totalMilesCap, 40);
  assert.equal(loaded.taper?.weeks.find((week) => week.weekIndex === 1)?.longRunCapMiles, 12);
  assert.equal(loaded.taper?.weeks.find((week) => week.weekIndex === 2)?.totalMilesCap, 30);
  assert.equal(loaded.taper?.weeks.find((week) => week.weekIndex === 2)?.longRunCapMiles, 8);
  assert.equal(loaded.raceWeekMiles, 18);
  assert.equal(loaded.raceWeek?.slots[0]?.prescribedMiles, null);
});
