import assert from "node:assert/strict";
import test from "node:test";
import { extractLapsFromFitMessages } from "./parse-fit-activity-laps";
import type { FitMessages } from "@garmin/fitsdk";

test("extractLapsFromFitMessages maps warmup interval recovery cooldown", () => {
  const start = new Date("2026-03-18T12:00:00Z");
  const messages: FitMessages = {
    sessionMesgs: [{ startTime: start }],
    lapMesgs: [
      {
        startTime: new Date("2026-03-18T12:00:00Z"),
        intensity: "warmup",
        totalElapsedTime: 300,
        totalTimerTime: 280,
        totalDistance: 800,
        avgSpeed: 2.5,
        avgHeartRate: 120,
        avgRunningCadence: 85,
        wktStepIndex: 0,
      },
      {
        startTime: new Date("2026-03-18T12:05:00Z"),
        intensity: "interval",
        totalElapsedTime: 240,
        totalTimerTime: 240,
        totalDistance: 804,
        avgSpeed: 3.35,
        avgHeartRate: 165,
      },
      {
        startTime: new Date("2026-03-18T12:09:00Z"),
        intensity: "recovery",
        totalElapsedTime: 90,
        totalTimerTime: 90,
      },
      {
        startTime: new Date("2026-03-18T12:10:30Z"),
        intensity: "cooldown",
        totalElapsedTime: 600,
        totalTimerTime: 580,
      },
    ],
  };

  const parsed = extractLapsFromFitMessages(messages);
  assert.equal(parsed.laps.length, 4);
  assert.equal(parsed.laps[0]!.type, "warmup");
  assert.equal(parsed.laps[1]!.type, "interval");
  assert.equal(parsed.laps[2]!.type, "recovery");
  assert.equal(parsed.laps[3]!.type, "cooldown");
  assert.equal(parsed.laps[0]!.wktStepIndex, 0);
  assert.equal(parsed.laps[0]!.avgCadence, 85);
  assert.equal(parsed.sessionStartTimeInSeconds, Math.floor(start.getTime() / 1000));
});

test("extractLapsFromFitMessages keeps unknown intensity on lap", () => {
  const messages: FitMessages = {
    lapMesgs: [
      {
        startTime: new Date("2026-03-18T12:00:00Z"),
        intensity: "mystery_step",
        totalElapsedTime: 60,
      },
    ],
  };

  const parsed = extractLapsFromFitMessages(messages);
  assert.equal(parsed.laps.length, 1);
  assert.equal(parsed.laps[0]!.type, "mystery_step");
  assert.equal(parsed.laps[0]!.rawIntensity, "mystery_step");
});
