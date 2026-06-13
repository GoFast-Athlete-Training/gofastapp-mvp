import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveGarminPushModeForBatch } from "./push-plan-workouts-batch";

describe("resolveGarminPushModeForBatch", () => {
  it("schedules new workouts", () => {
    assert.equal(resolveGarminPushModeForBatch(null, null, false), "schedule-today");
  });

  it("updates already scheduled workouts", () => {
    assert.equal(resolveGarminPushModeForBatch(10, 20, false), "update-library");
  });

  it("skips library-only rows during daily cron", () => {
    assert.equal(resolveGarminPushModeForBatch(10, null, false), "skip_library_only");
  });

  it("recovers library-only rows during weekly pre-push", () => {
    assert.equal(resolveGarminPushModeForBatch(10, null, true), "force-reschedule");
  });
});
