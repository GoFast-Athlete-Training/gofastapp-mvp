import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarDaysFromDateKeyToToday,
  deriveSessionStatus,
  isPastDateKeyMissed,
  localYmdFromDate,
} from "./session-status";

test("calendarDaysFromDateKeyToToday counts whole calendar days", () => {
  assert.equal(calendarDaysFromDateKeyToToday("2026-05-29", "2026-05-29"), 0);
  assert.equal(calendarDaysFromDateKeyToToday("2026-05-28", "2026-05-29"), 1);
  assert.equal(calendarDaysFromDateKeyToToday("2026-05-27", "2026-05-29"), 2);
});

test("yesterday morning is not missed (grace window)", () => {
  const now = new Date("2026-05-29T08:38:00");
  const today = localYmdFromDate(now);
  assert.equal(isPastDateKeyMissed("2026-05-28", today, now), false);
  assert.equal(
    deriveSessionStatus({
      dateKey: "2026-05-28",
      now,
      workoutType: "Easy",
      title: "Easy run",
    }),
    "today"
  );
});

test("yesterday after noon is missed", () => {
  const now = new Date("2026-05-29T12:30:00");
  const today = localYmdFromDate(now);
  assert.equal(isPastDateKeyMissed("2026-05-28", today, now), true);
  assert.equal(
    deriveSessionStatus({
      dateKey: "2026-05-28",
      now,
      workoutType: "Easy",
      title: "Easy run",
    }),
    "missed"
  );
});

test("two or more calendar days ago is missed even in the morning", () => {
  const now = new Date("2026-05-29T08:00:00");
  assert.equal(
    deriveSessionStatus({
      dateKey: "2026-05-27",
      now,
      workoutType: "Tempo",
      title: "Tempo",
    }),
    "missed"
  );
});

test("today unmatched stays today", () => {
  const now = new Date("2026-05-29T08:38:00");
  const today = localYmdFromDate(now);
  assert.equal(
    deriveSessionStatus({
      dateKey: today,
      now,
      workoutType: "Intervals",
      title: "Intervals",
    }),
    "today"
  );
});

test("completed and skipped take precedence over date", () => {
  const now = new Date("2026-05-29T08:00:00");
  assert.equal(
    deriveSessionStatus({
      dateKey: "2026-05-27",
      now,
      matchedActivityId: "act-1",
      workoutType: "Easy",
    }),
    "completed"
  );
  assert.equal(
    deriveSessionStatus({
      dateKey: "2026-05-27",
      now,
      skippedAt: "2026-05-28T12:00:00Z",
      workoutType: "Easy",
    }),
    "skipped"
  );
});
