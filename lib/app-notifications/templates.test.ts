import assert from "node:assert/strict";
import test from "node:test";
import { renderNotificationTemplate } from "./templates";

test("workout.tomorrow uses verify-and-send copy with workout facts", async () => {
  const rendered = await renderNotificationTemplate("workout.tomorrow", {
    workoutTitle: "2-1 Tempo",
    workoutType: "tempo",
    distanceMi: "7.0 mi",
  });
  assert.equal(rendered.title, "Tomorrow: 2-1 Tempo · 7.0 mi");
  assert.equal(
    rendered.body,
    "Please verify tempo 2-1 Tempo (7.0 mi) is correct in GoFast, then send it to your Garmin watch."
  );
});
