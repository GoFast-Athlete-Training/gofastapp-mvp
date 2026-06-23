import { describe, expect, it } from 'vitest';
import {
  hasAnyBodyBatterySignal,
  resolveBodyBatteryLevel,
  sanitizeGarminDailyForStorage,
} from './athlete-health-records';

describe('sanitizeGarminDailyForStorage', () => {
  it('removes dense heart rate sample maps', () => {
    const raw = {
      calendarDate: '2026-06-22',
      steps: 4272,
      timeOffsetHeartRateSamples: { '15': 46 },
      timeOffsetStressLevelValues: { '15': 1 },
    };
    const sanitized = sanitizeGarminDailyForStorage(raw);
    expect(sanitized).toMatchObject({ calendarDate: '2026-06-22', steps: 4272 });
    expect(sanitized).not.toHaveProperty('timeOffsetHeartRateSamples');
    expect(sanitized).not.toHaveProperty('timeOffsetStressLevelValues');
  });
});

describe('resolveBodyBatteryLevel', () => {
  it('prefers mostRecent over high/low', () => {
    expect(
      resolveBodyBatteryLevel({
        bodyBatteryMostRecentValue: 72,
        bodyBatteryHighestValue: 90,
        bodyBatteryChargedValue: 50,
      })
    ).toBe(72);
  });

  it('does not use charged as level', () => {
    expect(
      resolveBodyBatteryLevel({
        bodyBatteryChargedValue: 50,
        bodyBatteryDrainedValue: 36,
      })
    ).toBeNull();
  });
});

describe('hasAnyBodyBatterySignal', () => {
  it('is true when only charged/drained present', () => {
    expect(
      hasAnyBodyBatterySignal({
        bodyBatteryChargedValue: 50,
        bodyBatteryDrainedValue: 36,
      })
    ).toBe(true);
  });
});
