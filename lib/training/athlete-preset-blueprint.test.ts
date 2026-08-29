import assert from "node:assert/strict";
import test from "node:test";
import {
  athletePresetBuildStep,
  isAthletePresetBlueprintComplete,
  type AthletePresetRowForStep,
} from "@/lib/training/athlete-preset-blueprint";

function completeRow(
  patch: Partial<AthletePresetRowForStep> & {
    coachPlanOverview?: Record<string, unknown>;
  } = {}
): AthletePresetRowForStep {
  return {
    workoutStructure: { weeklyCounts: {} },
    longRunConfigId: "lr-1",
    easyConfigId: "easy-1",
    tempoConfigId: "tempo-1",
    intervalsConfigId: "int-1",
    coachPlanOverview: {
      cupsConfirmed: true,
      longRunConfirmed: true,
      tempoConfirmed: true,
      intervalConfirmed: true,
      adjusterConfirmed: true,
    },
    ...patch,
  };
}

test("athletePresetBuildStep returns complete when all flags and structure are set", () => {
  const row = completeRow();
  assert.equal(athletePresetBuildStep(row), "complete");
  assert.equal(isAthletePresetBlueprintComplete(row), true);
});

test("athletePresetBuildStep returns adjuster when adjusterConfirmed is missing", () => {
  const row = completeRow({
    coachPlanOverview: {
      cupsConfirmed: true,
      longRunConfirmed: true,
      tempoConfirmed: true,
      intervalConfirmed: true,
    },
  });
  assert.equal(athletePresetBuildStep(row), "adjuster");
  assert.equal(isAthletePresetBlueprintComplete(row), false);
});

test("athletePresetBuildStep returns longRun when workoutStructure is missing", () => {
  const row = completeRow({ workoutStructure: null });
  assert.equal(athletePresetBuildStep(row), "longRun");
});
