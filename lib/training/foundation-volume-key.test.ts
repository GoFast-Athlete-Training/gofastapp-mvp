import assert from "node:assert/strict";
import test from "node:test";
import { peakLongRunPoolFoundationKey } from "@/lib/training/long-run-pool-fields";
import { foundationWeeklyBandMeaning } from "@/lib/training/weekly-volume-key";

test("peakLongRunPoolFoundationKey bands", () => {
  assert.equal(peakLongRunPoolFoundationKey(55), "Good / strong — you're in good shape");
  assert.equal(peakLongRunPoolFoundationKey(60), "Ready to PR — you're in good shape");
  assert.equal(peakLongRunPoolFoundationKey(70), "Ready to PR — you're in good shape");
  assert.equal(peakLongRunPoolFoundationKey(45), null);
});

test("foundationWeeklyBandMeaning is athlete-facing", () => {
  assert.match(foundationWeeklyBandMeaning("FINISH"), /just finish/i);
  assert.match(foundationWeeklyBandMeaning("RACE"), /good shape/i);
  assert.match(foundationWeeklyBandMeaning("ELITE"), /go for it/i);
  assert.doesNotMatch(foundationWeeklyBandMeaning("RACE"), /Higdon/i);
});
