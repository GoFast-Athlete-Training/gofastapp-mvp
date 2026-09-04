import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  garminCalendarStateLabel,
  garminCalendarSyncState,
  normalizePushWorkoutOptions,
} from "./garmin-calendar-state";

describe("garminCalendarSyncState", () => {
  it("returns not_pushed when workoutPushed is false", () => {
    assert.equal(garminCalendarSyncState({ workoutPushed: false }), "not_pushed");
  });

  it("returns pushed when workoutPushed is true", () => {
    assert.equal(garminCalendarSyncState({ workoutPushed: true }), "pushed");
  });
});

describe("normalizePushWorkoutOptions", () => {
  it("accepts legacy schedule date string", () => {
    assert.deepEqual(normalizePushWorkoutOptions("2026-05-30"), {
      scheduleDateYmdOverride: "2026-05-30",
    });
  });
});

describe("garminCalendarStateLabel", () => {
  it("labels pushed", () => {
    assert.match(garminCalendarStateLabel("pushed"), /Sent to Garmin/i);
  });
});
