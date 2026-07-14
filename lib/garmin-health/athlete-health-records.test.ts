import { describe, expect, it } from 'vitest';
import {
  buildHealthDailyDto,
  hasAnyBodyBatterySignal,
  presentBodyBatterySummaryFields,
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

  it('removes dense body battery sample maps', () => {
    const raw = {
      calendarDate: '2026-07-14',
      bodyBatteryChargedValue: 49,
      timeOffsetBodyBatteryValues: { '0': 72, '900': 68 },
    };
    const sanitized = sanitizeGarminDailyForStorage(raw);
    expect(sanitized).toMatchObject({
      calendarDate: '2026-07-14',
      bodyBatteryChargedValue: 49,
    });
    expect(sanitized).not.toHaveProperty('timeOffsetBodyBatteryValues');
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

describe('presentBodyBatterySummaryFields', () => {
  it('lists only compact summary fields that are present', () => {
    expect(
      presentBodyBatterySummaryFields({
        bodyBatteryChargedValue: 49,
        bodyBatteryDrainedValue: 19,
        timeOffsetBodyBatteryValues: { '0': 72 },
      })
    ).toEqual(['bodyBatteryChargedValue', 'bodyBatteryDrainedValue']);
  });
});

describe('buildHealthDailyDto', () => {
  it('hydrates partial daily summary with charge/drain but no level/high/low', () => {
    const dto = buildHealthDailyDto({
      calendarDate: '2026-07-14',
      bodyBatteryChargedValue: 49,
      bodyBatteryDrainedValue: 19,
      restingHeartRateInBeatsPerMinute: 41,
      steps: 6051,
    });

    expect(dto).toEqual({
      calendarDate: '2026-07-14',
      bodyBatteryLevel: null,
      bodyBatteryHigh: null,
      bodyBatteryLow: null,
      bodyBatteryCharged: 49,
      bodyBatteryDrained: 19,
      restingHeartRate: 41,
      steps: 6051,
      activeKilocalories: null,
    });
  });

  it('hydrates full daily summary when Garmin sends level/high/low', () => {
    const dto = buildHealthDailyDto({
      calendarDate: '2026-07-14',
      bodyBatteryMostRecentValue: 72,
      bodyBatteryHighestValue: 90,
      bodyBatteryLowestValue: 28,
      bodyBatteryChargedValue: 49,
      bodyBatteryDrainedValue: 19,
    });

    expect(dto?.bodyBatteryLevel).toBe(72);
    expect(dto?.bodyBatteryHigh).toBe(90);
    expect(dto?.bodyBatteryLow).toBe(28);
    expect(dto?.bodyBatteryCharged).toBe(49);
    expect(dto?.bodyBatteryDrained).toBe(19);
  });
});
