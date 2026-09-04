import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveActivityLapsForDisplay } from './activity-lap-display';

test('deriveActivityLapsForDisplay returns one synthetic lap from summary actuals', () => {
  const laps = deriveActivityLapsForDisplay({
    distanceMeters: 1511,
    durationSeconds: 645,
  });
  assert.equal(laps.length, 1);
  assert.ok(laps[0]?.distanceMiles != null && laps[0].distanceMiles > 0.9);
  assert.ok((laps[0]?.paceSecPerMile ?? 0) > 0);
});

test('deriveActivityLapsForDisplay returns empty when no detail and no summary', () => {
  assert.deepEqual(deriveActivityLapsForDisplay({}), []);
});
