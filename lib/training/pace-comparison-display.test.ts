import assert from "node:assert/strict";
import test from "node:test";
import {
  computeBandPaceDelta,
  formatSignedBandDeltaSec,
} from "@/lib/training/pace-comparison-display";

test("formatSignedBandDeltaSec — faster, slower, in range, open", () => {
  const lo = 351;
  const hi = 383;
  assert.equal(formatSignedBandDeltaSec(332, lo, hi), "+19s");
  assert.equal(formatSignedBandDeltaSec(370, lo, hi), "0");
  assert.equal(formatSignedBandDeltaSec(400, lo, hi), "-17s");
  assert.equal(formatSignedBandDeltaSec(370, null, null), "—");
  assert.equal(formatSignedBandDeltaSec(null, lo, hi), "—");
});

test("computeBandPaceDelta matches signed display semantics", () => {
  const lo = 480;
  const hi = 480;
  assert.equal(computeBandPaceDelta(470, lo, hi), 10);
  assert.equal(computeBandPaceDelta(480, lo, hi), 0);
});
