import assert from "node:assert/strict";
import test from "node:test";
import { peakLongRunPoolFoundationKey } from "@/lib/training/long-run-pool-fields";
import {
  foundationWeeklyBandMeaning,
  foundationWeeklyComparisonRows,
} from "@/lib/training/weekly-volume-key";
import { foundationPeakPoolComparisonRows } from "@/lib/training/long-run-pool-fields";

test("peakLongRunPoolFoundationKey bands", () => {
  assert.equal(
    peakLongRunPoolFoundationKey(55),
    "Good / strong peak cycle — you're in good shape"
  );
  assert.equal(
    peakLongRunPoolFoundationKey(60),
    "Ready to PR — you're in good shape"
  );
  assert.equal(peakLongRunPoolFoundationKey(45), null);
});

test("foundationWeeklyBandMeaning is athlete-facing", () => {
  assert.match(foundationWeeklyBandMeaning("FINISH"), /just finish/i);
  assert.match(foundationWeeklyBandMeaning("RACE"), /good shape/i);
  assert.match(foundationWeeklyBandMeaning("ELITE"), /go for it/i);
  assert.doesNotMatch(foundationWeeklyBandMeaning("RACE"), /Higdon/i);
});

test("foundationWeeklyComparisonRows marks selected band", () => {
  const rows = foundationWeeklyComparisonRows({
    raceDistanceLabel: "Marathon",
    selectedBand: "ELITE",
  });
  assert.equal(rows.length, 3);
  assert.equal(rows.filter((r) => r.isSelected).length, 1);
  assert.equal(rows.find((r) => r.isSelected)?.band, "ELITE");
  assert.match(rows[2]!.rangeLabel, /50–60/);
});

test("foundationPeakPoolComparisonRows marks selected band", () => {
  const rows = foundationPeakPoolComparisonRows(70);
  assert.equal(rows.find((r) => r.isSelected)?.band, "ready_to_pr");
});
