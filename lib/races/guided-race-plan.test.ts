import assert from "node:assert/strict";
import test from "node:test";
import { buildGuidedRaceStretches } from "./guided-race-plan";

const GOAL_PACE = 414;

test("buildGuidedRaceStretches: Army Ten-Miler style segments use course names and mile ranges", () => {
  const stretches = buildGuidedRaceStretches({
    segments: [
      {
        order: 1,
        name: "Arlington Departure",
        mileMarker: "0–2",
        description: "Start near the Pentagon and follow Route 110 north.",
        runTip: "The energy of the race start gives way to a highway stretch.",
      },
      {
        order: 2,
        name: "Georgetown and Kennedy Center",
        mileMarker: "2–4",
        description: "Cross Key Bridge into Georgetown.",
      },
    ],
    totalMiles: 10,
    goalPaceSecPerMi: GOAL_PACE,
  });

  assert.equal(stretches.length, 2);
  assert.equal(stretches[0]!.title, "Arlington Departure");
  assert.equal(stretches[1]!.title, "Georgetown and Kennedy Center");
  assert.equal(stretches[0]!.mileRangeLabel, "0–2 mi");
  assert.equal(stretches[1]!.mileRangeLabel, "2–4 mi");
  assert.match(stretches[0]!.courseNote ?? "", /highway stretch/);
  assert.ok(stretches[0]!.paceBandLabel.includes("/mi"));
});

test("buildGuidedRaceStretches: empty segments uses even-pace mile targets", () => {
  const stretches = buildGuidedRaceStretches({
    segments: [],
    totalMiles: 10,
    goalPaceSecPerMi: GOAL_PACE,
  });
  assert.equal(stretches.length, 10);
  assert.ok(stretches.every((s) => s.title.startsWith("Mile ") || s.title.startsWith("Finish")));
});
