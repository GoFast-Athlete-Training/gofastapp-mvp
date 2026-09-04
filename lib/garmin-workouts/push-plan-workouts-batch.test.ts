import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dedupeBatchPushCandidates,
  shouldPushBatchCandidate,
} from "./push-plan-workouts-batch";

describe("shouldPushBatchCandidate", () => {
  it("pushes when workoutPushed is false", () => {
    assert.equal(shouldPushBatchCandidate(false), true);
  });

  it("skips when workoutPushed is true", () => {
    assert.equal(shouldPushBatchCandidate(true), false);
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
        workoutPushed: false,
      },
      {
        id: "b",
        athleteId: "ath1",
        planId: "p1",
        date,
        workoutPushed: true,
      },
      {
        id: "c",
        athleteId: "ath1",
        planId: "p1",
        date: new Date("2026-06-18T12:00:00.000Z"),
        workoutPushed: false,
      },
    ];
    const { toPush, duplicateSkips } = dedupeBatchPushCandidates(candidates);
    assert.equal(toPush.length, 2);
    assert.equal(toPush[0]?.id, "b");
    assert.equal(duplicateSkips.length, 1);
    assert.equal(duplicateSkips[0]?.id, "a");
  });

  it("prefers row with workoutPushed over unstamped sibling", () => {
    const candidates = [
      {
        id: "a",
        athleteId: "ath1",
        planId: "p1",
        date,
        workoutPushed: false,
      },
      {
        id: "b",
        athleteId: "ath1",
        planId: "p1",
        date,
        workoutPushed: true,
      },
    ];
    const { toPush, duplicateSkips } = dedupeBatchPushCandidates(candidates);
    assert.equal(toPush[0]?.id, "b");
    assert.equal(duplicateSkips[0]?.id, "a");
  });
});
