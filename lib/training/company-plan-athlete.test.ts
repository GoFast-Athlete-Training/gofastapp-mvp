import assert from "node:assert/strict";
import test from "node:test";
import { canonicalFiveKPace } from "./company-plan-athlete";

test("canonicalFiveKPace stores M:SS", () => {
  assert.deepEqual(canonicalFiveKPace("7:30"), { ok: true, pace: "7:30" });
  assert.deepEqual(canonicalFiveKPace("7:30/mi"), { ok: true, pace: "7:30" });
});

test("canonicalFiveKPace rejects a pace that is not a mile split", () => {
  const result = canonicalFiveKPace("fast");
  assert.equal(result.ok, false);
});
