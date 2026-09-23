import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateWeeklyAverageFromVolumePeak,
  presetCoreFromPreset,
} from "./preset-core";

test("presetCoreFromPreset uses max weekly as volume peak", () => {
  const core = presetCoreFromPreset({
    minWeeklyMiles: 40,
    maxWeeklyMiles: 55,
    coachPlanOverview: {
      summary: "Elite marathon",
      weeklyVolume: { min: 40, max: 55 },
      weeklyWorkoutComposition: { easy: 3, tempo: 1, intervals: 1, longRun: 1, cadenceWeeks: 1 },
      longRunStructure: { peakLongRunMiles: 21 },
    },
  });
  assert.equal(core.weeklyVolumePeakMiles, 55);
  assert.equal(core.longRunPeakMiles, 21);
  assert.equal(core.totalRunsPerWeek, 6);
  assert.equal(core.totalQualitySessionsPerWeek, 2);
  assert.equal(core.weeklyAverageMiles, calculateWeeklyAverageFromVolumePeak(55));
});

test("presetCoreFromPreset ignores large pool as long-run peak", () => {
  const core = presetCoreFromPreset({
    minWeeklyMiles: 40,
    maxWeeklyMiles: 55,
    peakLongRunPoolMiles: 70,
    coachPlanOverview: null,
  });
  assert.equal(core.longRunPeakMiles, null);
});
