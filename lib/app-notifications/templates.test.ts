import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPLETE_FEED_ID_PREFIX,
  REMINDER_FEED_ID_PREFIX,
  parseAppNotificationFeedId,
} from "./feed";
import { renderNotificationTemplate } from "./templates";

test("workout.tomorrow uses auto-sync copy with workout facts", async () => {
  const rendered = await renderNotificationTemplate("workout.tomorrow", {
    workoutTitle: "2-1 Tempo",
    workoutType: "Tempo",
    distanceMi: "7.0 mi",
  });
  assert.equal(rendered.title, "Tomorrow: 2-1 Tempo · 7.0 mi");
  assert.equal(
    rendered.body,
    "Your Tempo 2-1 Tempo (7.0 mi) is on your plan for tomorrow — GoFast syncs it to your Garmin watch automatically. Tap to preview."
  );
});

test("parseAppNotificationFeedId handles prefixed and legacy ids", () => {
  assert.deepEqual(parseAppNotificationFeedId(`${REMINDER_FEED_ID_PREFIX}w1`), {
    kind: "reminder",
    workoutId: "w1",
  });
  assert.deepEqual(parseAppNotificationFeedId(`${COMPLETE_FEED_ID_PREFIX}w2`), {
    kind: "complete",
    workoutId: "w2",
  });
  assert.deepEqual(parseAppNotificationFeedId("legacy-id"), {
    kind: "reminder",
    workoutId: "legacy-id",
  });
  assert.equal(parseAppNotificationFeedId(""), null);
});
