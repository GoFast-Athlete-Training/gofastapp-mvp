import assert from "node:assert/strict";
import test from "node:test";
import { splitRowTitle } from "./PaceForPacePanel";
import type { PhaseAwareLapRow } from "@/lib/training/workout-performance-analysis";

function workLap(multiMileRepeat: boolean): PhaseAwareLapRow {
  return {
    lapOrder: 1,
    lapIndex: 0,
    segmentId: "work",
    segmentTitle: "Work",
    phase: "work",
    paceSecPerMile: 413,
    avgHr: null,
    distanceMiles: multiMileRepeat ? 5 : 1,
    multiMileRepeat,
    targetPaceSecPerMile: 412,
    targetPaceSecPerMileHigh: 417,
    vsPlanPaceLabel: "On target",
    vsPlanTone: "good",
    paceDeltaSecPerMile: 0,
  };
}

test("easy work laps are singular miles, including miles inside a long repeat", () => {
  assert.equal(splitRowTitle(workLap(true), "Easy", 0), "Mile 1");
  assert.equal(splitRowTitle(workLap(true), "LongRun", 4), "Mile 5");
  assert.equal(splitRowTitle(workLap(false), "Easy", 0), "Mile 1");
});
