import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultGarminPushModeForState,
  garminCalendarStateLabel,
  garminCalendarSyncState,
  normalizePushWorkoutOptions,
  parseGarminPushModeFromBody,
} from "./garmin-calendar-state";

describe("garminCalendarSyncState", () => {
  it("returns not_pushed when no Garmin ids", () => {
    assert.equal(garminCalendarSyncState({}), "not_pushed");
  });

  it("returns scheduled_on_calendar when garminWorkoutId present", () => {
    assert.equal(
      garminCalendarSyncState({ garminWorkoutId: 1, garminScheduleId: null }),
      "scheduled_on_calendar"
    );
  });
});

describe("defaultGarminPushModeForState", () => {
  it("maps states to push modes", () => {
    assert.equal(defaultGarminPushModeForState("not_pushed"), "schedule-today");
    assert.equal(defaultGarminPushModeForState("library_only"), "update-library");
    assert.equal(defaultGarminPushModeForState("scheduled_on_calendar"), "update-library");
  });
});

describe("normalizePushWorkoutOptions", () => {
  it("accepts legacy schedule date string", () => {
    assert.deepEqual(normalizePushWorkoutOptions("2026-05-30"), {
      scheduleDateYmdOverride: "2026-05-30",
    });
  });

  it("accepts options object", () => {
    assert.deepEqual(
      normalizePushWorkoutOptions({ mode: "force-reschedule" }),
      { mode: "force-reschedule" }
    );
  });
});

describe("parseGarminPushModeFromBody", () => {
  it("parses valid mode", () => {
    assert.equal(parseGarminPushModeFromBody({ mode: "update-library" }), "update-library");
  });

  it("ignores invalid mode", () => {
    assert.equal(parseGarminPushModeFromBody({ mode: "send-to-watch" }), undefined);
  });
});

describe("garminCalendarStateLabel", () => {
  it("labels library_only", () => {
    assert.match(garminCalendarStateLabel("library_only"), /library/i);
  });
});
