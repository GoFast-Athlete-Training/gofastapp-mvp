import assert from "node:assert/strict";
import test from "node:test";
import {
  lapsHaveFlatSummaries,
  parseDetailData,
} from "./detail-data-parser";
import {
  convertLapsToDerived,
  normalizeActivityLapsFromDetail,
} from "./lap-converter";

test("parseDetailData reads flat Garmin lap summaries", () => {
  const parsed = parseDetailData({
    laps: [
      {
        startTimeInSeconds: 1000,
        timerDurationInSeconds: 600,
        totalDistanceInMeters: 1609.34,
        averageSpeedInMetersPerSecond: 2.68,
        averageHeartRateInBeatsPerMinute: 140,
      },
      {
        startTimeInSeconds: 1600,
        timerDurationInSeconds: 120,
        totalDistanceInMeters: 400,
        averageSpeedInMetersPerSecond: 3.35,
      },
    ],
  });

  assert.equal(parsed.laps.length, 2);
  assert.equal(lapsHaveFlatSummaries(parsed.laps), true);
  assert.equal(parsed.laps[0]!.durationSeconds, 600);
  assert.equal(parsed.laps[0]!.distanceMeters, 1609.34);
});

test("normalizeActivityLapsFromDetail prefers flat lap summaries over empty samples", () => {
  const derived = normalizeActivityLapsFromDetail({
    laps: [
      {
        startTimeInSeconds: 1000,
        timerDurationInSeconds: 600,
        totalDistanceInMeters: 1609.34,
        averageSpeedInMetersPerSecond: 2.68,
      },
      {
        startTimeInSeconds: 1600,
        timerDurationInSeconds: 120,
        totalDistanceInMeters: 400,
        averageSpeedInMetersPerSecond: 3.35,
      },
    ],
    samples: [],
  });

  assert.equal(derived.length, 2);
  assert.equal(derived[0]!.durationSeconds, 600);
  assert.ok(derived[0]!.distanceMiles != null && derived[0]!.distanceMiles! > 0.9);
  assert.ok(derived[0]!.avgPaceSecPerMile != null);
});

test("convertLapsToDerived still works with lap start times and samples", () => {
  const derived = convertLapsToDerived(
    [{ startTimeInSeconds: 100 }, { startTimeInSeconds: 200 }],
    [
      { startTimeInSeconds: 100, speedMetersPerSecond: 3.0 },
      { startTimeInSeconds: 150, speedMetersPerSecond: 3.2 },
      { startTimeInSeconds: 200, speedMetersPerSecond: 3.1 },
    ]
  );
  assert.equal(derived.length, 2);
  assert.ok(derived[0]!.avgPaceSecPerMile != null);
});
