import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogueSegmentDistanceMiles,
  isTempoWorkSegmentList,
  segmentPaceDistUsesDistanceMeters,
} from "./catalogue-segment-distance";

test("catalogueSegmentDistanceMiles converts 400m to miles", () => {
  const mi = catalogueSegmentDistanceMiles({ distanceMeters: 400 });
  assert.ok(mi != null && mi > 0.24 && mi < 0.26);
});

test("catalogueSegmentDistanceMiles converts 1200m to ~0.75 mi", () => {
  const mi = catalogueSegmentDistanceMiles({ distanceMeters: 1200 });
  assert.ok(mi != null && mi > 0.74 && mi < 0.76);
});

test("catalogueSegmentDistanceMiles prefers explicit miles", () => {
  assert.equal(catalogueSegmentDistanceMiles({ miles: 1.5, distanceMeters: 400 }), 1.5);
});

test("isTempoWorkSegmentList accepts distanceMeters rows", () => {
  const list = [
    { distanceMeters: 400, paceKey: "fast" },
    { distanceMeters: 400, paceKey: "somewhatFast" },
    { distanceMeters: 400, paceKey: "fast" },
  ];
  assert.equal(isTempoWorkSegmentList(list), true);
});

test("segmentPaceDistUsesDistanceMeters detects blockRepeat with meters", () => {
  assert.equal(
    segmentPaceDistUsesDistanceMeters({
      layout: "blockRepeat",
      segments: [{ distanceMeters: 400, paceOffsetSecPerMile: 30 }],
      repeatCount: 3,
    }),
    true
  );
});
