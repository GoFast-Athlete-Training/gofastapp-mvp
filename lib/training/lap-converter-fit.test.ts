import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeActivityLapsFromFit,
  normalizeActivityLapsPreferDetail,
} from "./lap-converter";

test("normalizeActivityLapsFromFit maps FIT warmup interval rows", () => {
  const derived = normalizeActivityLapsFromFit({
    fileType: "FIT",
    processedAt: "2026-03-18T12:00:00.000Z",
    sourceActivityId: "123",
    sessionStartTimeInSeconds: 1_772_236_800,
    laps: [
      {
        type: "warmup",
        rawIntensity: "warmup",
        startTimeInSeconds: 1_772_236_800,
        elapsedSeconds: 300,
        timerSeconds: 280,
        distanceMeters: 800,
        avgSpeedMps: 2.5,
        avgHeartRate: 120,
        avgCadence: 85,
        wktStepIndex: 0,
      },
      {
        type: "interval",
        rawIntensity: "interval",
        startTimeInSeconds: 1_772_237_100,
        elapsedSeconds: 240,
        timerSeconds: 240,
        distanceMeters: 804,
        avgSpeedMps: 3.35,
        avgHeartRate: 165,
        avgCadence: null,
        wktStepIndex: null,
      },
    ],
  });

  assert.equal(derived.length, 2);
  assert.equal(derived[0]!.intensity, "warmup");
  assert.equal(derived[0]!.durationSeconds, 280);
  assert.equal(derived[0]!.distanceMiles, 0.5);
  assert.equal(derived[1]!.intensity, "interval");
  assert.ok(derived[1]!.avgPaceSecPerMile != null && derived[1]!.avgPaceSecPerMile! > 0);
});

test("normalizeActivityLapsPreferDetail falls back to FIT when detail is empty", () => {
  const derived = normalizeActivityLapsPreferDetail({
    detailData: { laps: [] },
    fitLapData: {
      fileType: "FIT",
      processedAt: "2026-03-18T12:00:00.000Z",
      sourceActivityId: "123",
      sessionStartTimeInSeconds: 1_772_236_800,
      laps: [
        {
          type: "active",
          rawIntensity: "active",
          startTimeInSeconds: 1_772_236_800,
          elapsedSeconds: 600,
          timerSeconds: 590,
          distanceMeters: 1609,
          avgSpeedMps: 2.7,
          avgHeartRate: 150,
          avgCadence: null,
          wktStepIndex: null,
        },
      ],
    },
  });

  assert.equal(derived.length, 1);
  assert.equal(derived[0]!.durationSeconds, 590);
});
