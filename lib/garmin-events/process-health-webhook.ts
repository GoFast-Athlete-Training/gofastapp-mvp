/**
 * Process Garmin Health API webhook payloads (sleeps, dailies).
 */

import { handleSleepSummary } from './handleSleepSummary';
import { handleDailySummary } from './handleDailySummary';
import {
  fetchGarminPingCallbacks,
  isGarminPingPayload,
} from './fetch-garmin-ping-callbacks';
import { presentBodyBatterySummaryFields } from '../garmin-health/athlete-health-records';

const DEBUG = process.env.GARMIN_DEBUG === 'true';

function readUserIdFromObject(item: unknown): string | null {
  if (item !== null && typeof item === 'object' && 'userId' in item) {
    const u = (item as { userId?: unknown }).userId;
    if (u !== undefined && u !== null && String(u).length > 0) {
      return String(u);
    }
  }
  return null;
}

function resolveGarminUserIdFromBody(body: Record<string, unknown>): string | null {
  if (body.userId !== undefined && body.userId !== null && String(body.userId).length > 0) {
    return String(body.userId);
  }
  for (const key of ['sleeps', 'dailies'] as const) {
    const arr = body[key];
    if (Array.isArray(arr) && arr.length > 0) {
      const u = readUserIdFromObject(arr[0]);
      if (u) return u;
    }
  }
  return null;
}

function logDailyBodyBatteryFieldPresence(dailies: unknown[]): void {
  for (const raw of dailies) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const record = raw as Record<string, unknown>;
    if (typeof record.callbackURL === 'string' && record.callbackURL.length > 0) continue;

    const present = presentBodyBatterySummaryFields(record);
    const strippedSampleKeys = [
      'timeOffsetBodyBatteryValues',
      'timeOffsetHeartRateSamples',
      'timeOffsetStressLevelValues',
    ].filter((key) => record[key] != null);

    console.log('[GARMIN HEALTH] daily bodyBattery summary fields', {
      calendarDate: record.calendarDate ?? null,
      present,
      strippedSampleKeys,
      partialOnly:
        present.length > 0 &&
        !present.some((k) =>
          [
            'bodyBatteryMostRecentValue',
            'bodyBatteryHighestValue',
            'bodyBatteryHighValue',
            'bodyBatteryLowestValue',
            'bodyBatteryLowValue',
          ].includes(k)
        ),
    });
  }
}

async function handlePingOrPush<T extends { userId?: string }>(
  label: string,
  items: unknown[],
  userId: string | undefined,
  handler: (fetched: unknown[], uid?: string) => Promise<{ processed: number; skipped: number; errors: number }>
): Promise<void> {
  const first = items[0];
  const isPing = isGarminPingPayload(first);

  if (isPing) {
    const garminUserIdFromPing =
      userId ?? (items[0] as { userId?: string })?.userId;
    if (!garminUserIdFromPing) {
      console.warn(`⚠️ Garmin ${label} PING: no userId in payload`);
      return;
    }

    const allFetched = await fetchGarminPingCallbacks(items as Array<{ callbackURL?: string }>);
    if (allFetched.length === 0) {
      console.log(`📩 Garmin ${label} PING: no data returned from callbackURLs`);
      return;
    }

    const result = await handler(allFetched, garminUserIdFromPing);
    console.log(`📩 Garmin ${label} PING processed`, { fetched: allFetched.length, ...result });
    return;
  }

  const result = await handler(items, userId);
  console.log(`📩 Garmin ${label} PUSH processed`, { ...result, userId: userId ?? '(none)' });
}

/**
 * Background health webhook processing. Must not throw to caller.
 */
export async function processGarminHealthWebhook(rawText: string): Promise<void> {
  try {
    console.log('[GARMIN HEALTH RAW]', rawText.slice(0, 500));

    let body: Record<string, unknown> = {};
    try {
      const t = rawText?.trim() ?? '';
      const parsed = t ? JSON.parse(t) : {};
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      body = {};
    }

    const garminUserId = resolveGarminUserIdFromBody(body);
    const keys = Object.keys(body);

    console.log('[GARMIN HEALTH] payload', {
      keys,
      userId: garminUserId ?? '(none)',
      sleepsCount: Array.isArray(body.sleeps) ? body.sleeps.length : 0,
      dailiesCount: Array.isArray(body.dailies) ? body.dailies.length : 0,
      timestamp: new Date().toISOString(),
    });

    if (DEBUG) {
      try {
        console.log('[GARMIN HEALTH] body:', JSON.stringify(body, null, 2));
      } catch {
        /* ignore */
      }
    }

    const sleeps = body.sleeps;
    if (Array.isArray(sleeps) && sleeps.length > 0) {
      try {
        await handlePingOrPush(
          'sleep',
          sleeps,
          (body.userId as string | undefined) ?? garminUserId ?? undefined,
          handleSleepSummary
        );
      } catch (err: unknown) {
        console.error('[GARMIN HEALTH] sleep handler:', err);
      }
    }

    const dailies = body.dailies;
    if (Array.isArray(dailies) && dailies.length > 0) {
      logDailyBodyBatteryFieldPresence(dailies);
      try {
        await handlePingOrPush(
          'daily',
          dailies,
          (body.userId as string | undefined) ?? garminUserId ?? undefined,
          handleDailySummary
        );
      } catch (err: unknown) {
        console.error('[GARMIN HEALTH] daily handler:', err);
      }
    }

    const healthKeys = ['epochs', 'stressDetails', 'hrv', 'pulseOx', 'respiration', 'bodyComps'];
    const unknownHealth = keys.filter((k) => healthKeys.includes(k));
    if (unknownHealth.length > 0) {
      console.warn('[GARMIN HEALTH] unhandled health keys (disabled in portal?)', unknownHealth);
    }

    if (
      keys.length > 0 &&
      !Array.isArray(sleeps) &&
      !Array.isArray(dailies) &&
      unknownHealth.length === 0
    ) {
      console.warn('[GARMIN HEALTH] no sleeps/dailies in payload', { keys });
    }
  } catch (error: unknown) {
    console.error('[GARMIN HEALTH] processGarminHealthWebhook:', error);
  }
}

/** True if body looks like health data mistakenly sent to activity webhook. */
export function bodyHasHealthKeys(body: Record<string, unknown>): boolean {
  return ['sleeps', 'dailies', 'epochs', 'stressDetails', 'hrv'].some((k) => k in body);
}
