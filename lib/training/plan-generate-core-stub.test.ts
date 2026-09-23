import test from "node:test";
import assert from "node:assert/strict";
import { stubPlanGenerateRulesFromPreset } from "./plan-generate-core-stub";

test("stubPlanGenerateRulesFromPreset returns awareness rules", () => {
  const out = stubPlanGenerateRulesFromPreset({
    minWeeklyMiles: 40,
    maxWeeklyMiles: 55,
    coachPlanOverview: {
      summary: "Test",
      weeklyVolume: { min: 40, max: 55 },
      weeklyWorkoutComposition: { easy: 3, tempo: 1, intervals: 1, longRun: 1, cadenceWeeks: 1 },
      longRunStructure: { peakLongRunMiles: 21 },
    },
    totalWeeks: 12,
    longRunRotationSlots: [
      { cyclePosition: 0, slotMiles: 12 },
      { cyclePosition: 1, slotMiles: 14 },
    ],
  });
  assert.equal(out.rules.qualityCountsAreAwarenessOnly, true);
  assert.equal(out.presetCore.totalQualitySessionsPerWeek, 2);
  assert.ok(out.longRunPreview && out.longRunPreview.length === 12);
});
