/**
 * Garmin Health records (daily / sleep) — FK-backed storage off Athlete row.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';

export const GARMIN_HEALTH_SOURCE = 'garmin' as const;
export const HEALTH_TYPE_DAILY = 'daily' as const;
export const HEALTH_TYPE_SLEEP = 'sleep' as const;

export type GarminHealthType = typeof HEALTH_TYPE_DAILY | typeof HEALTH_TYPE_SLEEP;

/** Dense Garmin daily keys we never need in storage or UI. */
const DAILY_INGEST_STRIP_KEYS = [
  'timeOffsetHeartRateSamples',
  'timeOffsetStressLevelValues',
  'timeOffsetBodyBatteryValues',
] as const;

export type HealthDailyDto = {
  calendarDate: string | null;
  bodyBatteryLevel: number | null;
  bodyBatteryHigh: number | null;
  bodyBatteryLow: number | null;
  bodyBatteryCharged: number | null;
  bodyBatteryDrained: number | null;
  restingHeartRate: number | null;
  steps: number | null;
  activeKilocalories: number | null;
};

export type HealthSleepDto = {
  calendarDate: string | null;
  durationInSeconds: number | null;
  deepSleepDurationInSeconds: number | null;
  lightSleepDurationInSeconds: number | null;
  remSleepInSeconds: number | null;
  awakeDurationInSeconds: number | null;
};

export type HealthHydration = {
  garminConnected: boolean;
  lastSyncAt: string | null;
  daily: HealthDailyDto | null;
  sleep: HealthSleepDto | null;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function readNum(obj: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  }
  return null;
}

function readCalendarDateString(raw: unknown): string | null {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return raw;
}

export function parseGarminCalendarDate(raw: unknown): Date | null {
  const cd = readCalendarDateString(raw);
  if (!cd) return null;
  const t = Date.parse(`${cd}T12:00:00Z`);
  return Number.isFinite(t) ? new Date(t) : null;
}

export function readSourceSummaryId(summary: Record<string, unknown>): string {
  const id = summary.summaryId ?? summary.userId;
  if (id !== undefined && id !== null && String(id).length > 0) {
    return String(id);
  }
  const cd = summary.calendarDate;
  if (typeof cd === 'string' && cd.length > 0) {
    return `${cd}-unknown`;
  }
  return `unknown-${Date.now()}`;
}

/** Strip dense sample maps before persisting daily summaries. */
export function sanitizeGarminDailyForStorage(raw: Record<string, unknown>): Record<string, unknown> {
  const out = { ...raw };
  for (const key of DAILY_INGEST_STRIP_KEYS) {
    delete out[key];
  }
  return out;
}

/** Resolve 0–100 body battery level — never use charged/drained as level. */
export function resolveBodyBatteryLevel(raw: Record<string, unknown>): number | null {
  return readNum(
    raw,
    'bodyBatteryMostRecentValue',
    'bodyBatteryHighestValue',
    'bodyBatteryHighValue',
    'bodyBatteryLowestValue',
    'bodyBatteryLowValue'
  );
}

export function hasAnyBodyBatterySignal(raw: Record<string, unknown>): boolean {
  return (
    resolveBodyBatteryLevel(raw) != null ||
    readNum(raw, 'bodyBatteryChargedValue') != null ||
    readNum(raw, 'bodyBatteryDrainedValue') != null ||
    readNum(raw, 'restingHeartRateInBeatsPerMinute') != null
  );
}

/** Garmin daily Body Battery summary keys (compact fields only — not time-series samples). */
export const BODY_BATTERY_SUMMARY_KEYS = [
  'bodyBatteryMostRecentValue',
  'bodyBatteryHighestValue',
  'bodyBatteryHighValue',
  'bodyBatteryLowestValue',
  'bodyBatteryLowValue',
  'bodyBatteryChargedValue',
  'bodyBatteryDrainedValue',
] as const;

/** Which compact Body Battery summary fields are present on a daily record (for logging). */
export function presentBodyBatterySummaryFields(raw: Record<string, unknown>): string[] {
  return BODY_BATTERY_SUMMARY_KEYS.filter((key) => raw[key] != null);
}

/** Build compact daily DTO from stored or incoming Garmin daily summary JSON. */
export function buildHealthDailyDto(raw: unknown): HealthDailyDto | null {
  if (!isRecord(raw)) return null;
  if (!hasAnyBodyBatterySignal(raw) && readNum(raw, 'steps') == null) return null;

  return {
    calendarDate: readCalendarDateString(raw.calendarDate),
    bodyBatteryLevel: resolveBodyBatteryLevel(raw),
    bodyBatteryHigh: readNum(raw, 'bodyBatteryHighestValue', 'bodyBatteryHighValue'),
    bodyBatteryLow: readNum(raw, 'bodyBatteryLowestValue', 'bodyBatteryLowValue'),
    bodyBatteryCharged: readNum(raw, 'bodyBatteryChargedValue'),
    bodyBatteryDrained: readNum(raw, 'bodyBatteryDrainedValue'),
    restingHeartRate: readNum(raw, 'restingHeartRateInBeatsPerMinute'),
    steps: readNum(raw, 'steps'),
    activeKilocalories: readNum(raw, 'activeKilocalories'),
  };
}

function buildSleepDto(raw: unknown): HealthSleepDto | null {
  if (!isRecord(raw)) return null;
  const hasSleep =
    readNum(raw, 'durationInSeconds') != null ||
    readNum(raw, 'deepSleepDurationInSeconds') != null ||
    readNum(raw, 'lightSleepDurationInSeconds') != null ||
    readNum(raw, 'remSleepInSeconds') != null;
  if (!hasSleep) return null;

  return {
    calendarDate: readCalendarDateString(raw.calendarDate),
    durationInSeconds: readNum(raw, 'durationInSeconds'),
    deepSleepDurationInSeconds: readNum(raw, 'deepSleepDurationInSeconds'),
    lightSleepDurationInSeconds: readNum(raw, 'lightSleepDurationInSeconds'),
    remSleepInSeconds: readNum(raw, 'remSleepInSeconds'),
    awakeDurationInSeconds: readNum(raw, 'awakeDurationInSeconds'),
  };
}

export async function upsertGarminHealthRecord(
  athleteId: string,
  healthType: GarminHealthType,
  summary: Record<string, unknown>
): Promise<void> {
  const stored =
    healthType === HEALTH_TYPE_DAILY ? sanitizeGarminDailyForStorage(summary) : summary;
  const sourceSummaryId = readSourceSummaryId(stored);
  const calendarDate = parseGarminCalendarDate(stored.calendarDate);
  const summaryData = stored as unknown as Prisma.InputJsonValue;

  await prisma.athlete_health_records.upsert({
    where: {
      source_healthType_sourceSummaryId: {
        source: GARMIN_HEALTH_SOURCE,
        healthType,
        sourceSummaryId,
      },
    },
    create: {
      athleteId,
      source: GARMIN_HEALTH_SOURCE,
      healthType,
      sourceSummaryId,
      calendarDate,
      summaryData,
    },
    update: {
      calendarDate,
      summaryData,
    },
  });

  await prisma.athlete.update({
    where: { id: athleteId },
    data: { garmin_last_sync_at: new Date() },
  });
}

export async function buildHealthHydration(athleteId: string): Promise<HealthHydration> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: {
      garmin_access_token: true,
      garmin_last_sync_at: true,
    },
  });

  const garminConnected = !!(
    athlete?.garmin_access_token && athlete.garmin_access_token.length > 0
  );

  const [dailyRow, sleepRow] = await Promise.all([
    prisma.athlete_health_records.findFirst({
      where: { athleteId, source: GARMIN_HEALTH_SOURCE, healthType: HEALTH_TYPE_DAILY },
      orderBy: [{ calendarDate: 'desc' }, { updatedAt: 'desc' }],
      select: { summaryData: true },
    }),
    prisma.athlete_health_records.findFirst({
      where: { athleteId, source: GARMIN_HEALTH_SOURCE, healthType: HEALTH_TYPE_SLEEP },
      orderBy: [{ calendarDate: 'desc' }, { updatedAt: 'desc' }],
      select: { summaryData: true },
    }),
  ]);

  return {
    garminConnected,
    lastSyncAt: athlete?.garmin_last_sync_at?.toISOString() ?? null,
    daily: buildHealthDailyDto(dailyRow?.summaryData ?? null),
    sleep: buildSleepDto(sleepRow?.summaryData ?? null),
  };
}
