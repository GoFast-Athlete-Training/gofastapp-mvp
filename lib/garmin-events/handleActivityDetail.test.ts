import assert from "node:assert/strict";
import test from "node:test";
import {
  activityIdCandidates,
  isDetailFallbackCreateEnabled,
} from "./handleActivityDetail";

test("activityIdCandidates derives ids from activityId, summary.activityId, and summaryId", () => {
  assert.deepEqual(
    activityIdCandidates({
      activityId: 14137772,
      summaryId: "14529385-detail",
      summary: { activityId: 14529385 },
    }),
    ["14137772", "14529385"]
  );
});

test("activityIdCandidates strips -detail suffix from summaryId", () => {
  assert.deepEqual(
    activityIdCandidates({
      summaryId: "14229628-detail",
      summary: { activityId: 13938903 },
    }),
    ["13938903", "14229628"]
  );
});

test("isDetailFallbackCreateEnabled is opt-in via env var", () => {
  const previous = process.env.GARMIN_DETAIL_CREATE_MISSING_ACTIVITY;
  try {
    delete process.env.GARMIN_DETAIL_CREATE_MISSING_ACTIVITY;
    assert.equal(isDetailFallbackCreateEnabled(), false);

    process.env.GARMIN_DETAIL_CREATE_MISSING_ACTIVITY = "true";
    assert.equal(isDetailFallbackCreateEnabled(), true);

    process.env.GARMIN_DETAIL_CREATE_MISSING_ACTIVITY = "false";
    assert.equal(isDetailFallbackCreateEnabled(), false);
  } finally {
    if (previous === undefined) {
      delete process.env.GARMIN_DETAIL_CREATE_MISSING_ACTIVITY;
    } else {
      process.env.GARMIN_DETAIL_CREATE_MISSING_ACTIVITY = previous;
    }
  }
});
