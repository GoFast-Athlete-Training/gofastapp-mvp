/**
 * Handle Garmin wellness sleep push / fetch results.
 * Upserts into athlete_health_records (healthType = sleep).
 */

import { getAthleteByGarminUserId } from '../domain-garmin';
import {
  HEALTH_TYPE_SLEEP,
  upsertGarminHealthRecord,
  parseGarminCalendarDate,
} from '../garmin-health/athlete-health-records';

export interface SleepSummary {
  userId?: string;
  summaryId?: string | number;
  calendarDate?: string;
  startTimeInSeconds?: number;
  startTimeOffsetInSeconds?: number;
  durationInSeconds?: number;
  unmeasurableSleepInSeconds?: number;
  deepSleepDurationInSeconds?: number;
  lightSleepDurationInSeconds?: number;
  remSleepInSeconds?: number;
  awakeDurationInSeconds?: number;
  [key: string]: unknown;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function coerceSleepSummary(raw: unknown): SleepSummary | null {
  if (!isRecord(raw)) return null;
  const callbackURL = raw.callbackURL;
  if (typeof callbackURL === 'string' && callbackURL.length > 0) {
    return null;
  }
  return raw as SleepSummary;
}

function sleepSortKey(s: SleepSummary): number {
  const cd = parseGarminCalendarDate(s.calendarDate);
  if (cd) return cd.getTime();
  const sec = s.startTimeInSeconds;
  if (typeof sec === 'number' && Number.isFinite(sec)) {
    return sec * 1000;
  }
  return 0;
}

function latestSleepInBatch(items: SleepSummary[]): SleepSummary | null {
  let best: SleepSummary | null = null;
  let bestKey = -Infinity;
  for (const s of items) {
    const k = sleepSortKey(s);
    if (k >= bestKey) {
      bestKey = k;
      best = s;
    }
  }
  return best;
}

export async function handleSleepSummary(
  sleepItems: unknown[],
  userId?: string
): Promise<{ processed: number; skipped: number; errors: number }> {
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  const byGarminUser = new Map<string, SleepSummary[]>();

  for (const raw of sleepItems) {
    const s = coerceSleepSummary(raw);
    if (!s) {
      skipped++;
      continue;
    }
    const gid = userId ?? (typeof s.userId === 'string' ? s.userId : undefined);
    if (!gid) {
      console.warn('⚠️ No userId in sleep summary');
      skipped++;
      continue;
    }
    let arr = byGarminUser.get(gid);
    if (!arr) {
      arr = [];
      byGarminUser.set(gid, arr);
    }
    arr.push(s);
  }

  for (const [garminUserId, batch] of byGarminUser) {
    try {
      const athlete = await getAthleteByGarminUserId(garminUserId);
      if (!athlete) {
        console.warn(`⚠️ Athlete not found for Garmin userId (sleep): ${garminUserId}`);
        skipped += batch.length;
        continue;
      }

      const winner = latestSleepInBatch(batch);
      if (!winner) {
        skipped += batch.length;
        continue;
      }

      await upsertGarminHealthRecord(athlete.id, HEALTH_TYPE_SLEEP, winner as Record<string, unknown>);

      console.log('✅ athlete_health_records sleep upserted', {
        athleteId: athlete.id,
        garminUserId,
        calendarDate: winner.calendarDate ?? null,
        summaryId: winner.summaryId ?? null,
      });

      processed++;
    } catch (err: unknown) {
      errors++;
      console.error(`❌ Error processing sleep for Garmin user ${garminUserId}:`, err);
    }
  }

  return { processed, skipped, errors };
}
