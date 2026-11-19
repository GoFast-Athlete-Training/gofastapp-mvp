import assert from "node:assert/strict";
import test from "node:test";
import { cataloguePrescriptionLine, collapsedSegmentTitles } from "./catalogue-prescription-line";

test("cataloguePrescriptionLine reads reps, recovery, and the 5K offset", () => {
  const line = cataloguePrescriptionLine({
    paceAnchor: "fiveKPace",
    workBaseReps: 5,
    workBaseRepMeters: 1000,
    recoveryDistanceMeters: 400,
    workBasePaceOffsetSecPerMile: 0,
  });
  assert.equal(line, "5×1000m · 400m recovery · 0s vs 5K");
});

test("cataloguePrescriptionLine prefers a segment ladder over the legacy rep fields", () => {
  const line = cataloguePrescriptionLine({
    segmentPaceDist: [{ distanceMeters: 400, reps: 8, paceOffsetSecPerMile: -10 }],
    recoveryDurationSeconds: 60,
    workBaseReps: 5,
    workBaseRepMeters: 1000,
  });
  assert.equal(line, "8×400m · 60s recovery · -10s vs 5K");
});

test("collapsedSegmentTitles counts repeated step names", () => {
  const line = collapsedSegmentTitles([
    { title: "Warmup" },
    { title: "Interval" },
    { title: "Recovery" },
    { title: "Interval" },
    { title: "Recovery" },
    { title: "Cooldown" },
  ]);
  assert.equal(line, "Warmup · Interval × 2 · Recovery × 2 · Cooldown");
});
