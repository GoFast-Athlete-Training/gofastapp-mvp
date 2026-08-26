import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPaceResolutionContext,
  resolveCataloguePaceSecPerMile,
} from "@/lib/training/pace-key-resolver";
import { DEFAULT_ATHLETE_PACE_ADJUSTER } from "@/lib/training/athlete-pace-adjuster";

const ANCHOR_SEC = 386; // 6:26/mi

test("resolveCataloguePaceSecPerMile adds catalogue offset and type adjuster", () => {
  const ctx = buildPaceResolutionContext({
    anchorSecondsPerMile: ANCHOR_SEC,
    racePaceSecondsPerMile: null,
    workoutType: "Tempo",
    paceAdjuster: { ...DEFAULT_ATHLETE_PACE_ADJUSTER, threshold: -20 },
  });
  assert.equal(
    resolveCataloguePaceSecPerMile({ legacyOffsetSecPerMile: 30, ctx }),
    ANCHOR_SEC + 30 - 20
  );
});

test("resolveCataloguePaceSecPerMile uses zero adjuster when type not in profile defaults", () => {
  const ctx = buildPaceResolutionContext({
    anchorSecondsPerMile: ANCHOR_SEC,
    racePaceSecondsPerMile: null,
    workoutType: "Easy",
    paceAdjuster: { easy: -10, longRun: 0, threshold: 0, interval: 0 },
  });
  assert.equal(
    resolveCataloguePaceSecPerMile({ legacyOffsetSecPerMile: 90, ctx }),
    ANCHOR_SEC + 90 - 10
  );
});
