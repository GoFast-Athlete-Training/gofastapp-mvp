import assert from "node:assert/strict";
import test from "node:test";
import { computeLongRunTrajectoryPreview } from "./long-run-trajectory-preview";

test("computeLongRunTrajectoryPreview splits equal weights evenly across peak block", () => {
  const { rows, peakBlock } = computeLongRunTrajectoryPreview({
    totalWeeks: 16,
    peakLongRunPoolMiles: 76.4,
    fitnessPhase: "PEAK",
  });
  assert.deepEqual(peakBlock, { startWeek: 9, endWeek: 12 });
  const peakRows = rows.filter((r) => r.isPeakBlock);
  assert.equal(peakRows.length, 4);
  for (const row of peakRows) {
    assert.equal(row.miles, 19.1);
  }
});

test("computeLongRunTrajectoryPreview ramps build blocks for BASE fitness phase", () => {
  const peak = computeLongRunTrajectoryPreview({
    totalWeeks: 16,
    peakLongRunPoolMiles: 70,
    fitnessPhase: "PEAK",
  });
  const base = computeLongRunTrajectoryPreview({
    totalWeeks: 16,
    peakLongRunPoolMiles: 70,
    fitnessPhase: "BASE",
  });
  assert.ok((base.rows[0]?.miles ?? 0) < (peak.rows[0]?.miles ?? 0));
});
