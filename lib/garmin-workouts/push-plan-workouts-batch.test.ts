import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dedupeBatchPushCandidates,
  resolveGarminPushModeForBatch,
} from "./push-plan-workouts-batch";

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

describe("dedupeBatchPushCandidates", () => {
  const date = new Date("2026-06-17T12:00:00.000Z");

  it("keeps one canonical row per athlete plan day", () => {
    const candidates = [
      {
        id: "a",
        athleteId: "ath1",
        planId: "p1",
        date,
        garminWorkoutId: null,
        garminScheduleId: null,
      },
      {
        id: "b",
        athleteId: "ath1",
        planId: "p1",
        date,
        garminWorkoutId: 10,
        garminScheduleId: null,
      },
      {
        id: "c",
        athleteId: "ath1",
        planId: "p1",
        date: new Date("2026-06-18T12:00:00.000Z"),
        garminWorkoutId: null,
        garminScheduleId: null,
      },
    ];
    const { toPush, duplicateSkips } = dedupeBatchPushCandidates(candidates);
    assert.equal(toPush.length, 2);
    assert.equal(toPush[0]?.id, "b");
    assert.equal(duplicateSkips.length, 1);
    assert.equal(duplicateSkips[0]?.id, "a");
  });

  it("prefers row with garminScheduleId over library-only sibling", () => {
    const candidates = [
      {
        id: "a",
        athleteId: "ath1",
        planId: "p1",
        date,
        garminWorkoutId: 10,
        garminScheduleId: null,
      },
      {
        id: "b",
        athleteId: "ath1",
        planId: "p1",
        date,
        garminWorkoutId: 10,
        garminScheduleId: 20,
      },
    ];
    const { toPush, duplicateSkips } = dedupeBatchPushCandidates(candidates);
    assert.equal(toPush[0]?.id, "b");
    assert.equal(duplicateSkips[0]?.id, "a");
  });
});
