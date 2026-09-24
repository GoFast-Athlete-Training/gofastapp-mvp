import assert from "node:assert/strict";
import test from "node:test";
import { buildActivityMileLapsFromActivityDetail } from "./activity-mile-laps";

test("buildActivityMileLapsFromActivityDetail accumulates two full miles", () => {
  const laps = buildActivityMileLapsFromActivityDetail({
    fitLapData: {
      fileType: "fit",
      processedAt: "2026-01-01T00:00:00.000Z",
      sourceActivityId: "test",
      sessionStartTimeInSeconds: 0,
      laps: [
        {
          type: "active",
          rawIntensity: null,
          startTimeInSeconds: 0,
          elapsedSeconds: 480,
          timerSeconds: 480,
          distanceMeters: 1609.34,
          avgSpeedMps: 3.35,
          avgHeartRate: null,
          avgCadence: null,
          wktStepIndex: null,
        },
        {
          type: "active",
          rawIntensity: null,
          startTimeInSeconds: 480,
          elapsedSeconds: 500,
          timerSeconds: 500,
          distanceMeters: 1609.34,
          avgSpeedMps: 3.22,
          avgHeartRate: null,
          avgCadence: null,
          wktStepIndex: null,
        },
      ],
    },
  });

  assert.equal(laps.length, 2);
  assert.equal(laps[0]!.mileIndex, 0);
  assert.equal(laps[1]!.mileIndex, 1);
  assert.ok(laps[0]!.paceSecPerMile != null && laps[0]!.paceSecPerMile > 0);
});
