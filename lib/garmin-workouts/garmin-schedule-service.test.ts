import assert from "node:assert/strict";
import test from "node:test";
import { GarminApiError } from "./garmin-training-api";
import {
  deleteGarminScheduleIfPresent,
  scheduleWorkoutOnCalendar,
  type GarminScheduleClient,
} from "./garmin-schedule-service";

function mockClient(overrides: Partial<GarminScheduleClient>): GarminScheduleClient {
  return {
    scheduleWorkout: async () => ({ scheduleId: 999 }),
    getSchedule: async () => ({ workoutId: 1, date: "2026-05-29" }),
    deleteSchedule: async () => {},
    ...overrides,
  };
}

test("scheduleWorkoutOnCalendar succeeds on POST /schedule", async () => {
  let scheduled = false;
  const result = await scheduleWorkoutOnCalendar(
    mockClient({
      scheduleWorkout: async (workoutId, date) => {
        assert.equal(workoutId, 42);
        assert.equal(date, "2026-05-29");
        scheduled = true;
        return { scheduleId: 555 };
      },
    }),
    { garminWorkoutId: 42, scheduledDate: "2026-05-29" }
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.garminScheduleId, 555);
  }
  assert.equal(scheduled, true);
});

test("scheduleWorkoutOnCalendar fails when scheduleWorkout throws", async () => {
  const result = await scheduleWorkoutOnCalendar(
    mockClient({
      scheduleWorkout: async () => {
        throw new GarminApiError({
          status: 502,
          url: "/schedule",
          details: "bad gateway",
        });
      },
    }),
    { garminWorkoutId: 42, scheduledDate: "2026-05-29" }
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.garminStatus, 502);
    assert.match(result.message, /bad gateway/);
  }
});

test("deleteGarminScheduleIfPresent treats 404 as stale schedule id", async () => {
  const result = await deleteGarminScheduleIfPresent(
    mockClient({
      deleteSchedule: async () => {
        throw new GarminApiError({
          status: 404,
          url: "/schedule/1",
          details: "gone",
        });
      },
    }),
    123
  );
  assert.equal(result.wasStaleOnGarmin, true);
});

test("deleteGarminScheduleIfPresent no-ops when schedule id is null", async () => {
  let called = false;
  await deleteGarminScheduleIfPresent(
    mockClient({
      deleteSchedule: async () => {
        called = true;
      },
    }),
    null
  );
  assert.equal(called, false);
});
