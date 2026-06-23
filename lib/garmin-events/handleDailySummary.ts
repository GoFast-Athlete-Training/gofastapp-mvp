/**
 * Handle Garmin wellness daily push / fetch results.
 * Upserts into athlete_health_records (healthType = daily).
 */

import { getAthleteByGarminUserId } from '../domain-garmin';
import {
  HEALTH_TYPE_DAILY,
  upsertGarminHealthRecord,
  parseGarminCalendarDate,
} from '../garmin-health/athlete-health-records';

export interface DailySummary {
  userId?: string;
  summaryId?: string | number;
  calendarDate?: string;
  bodyBatteryMostRecentValue?: number;
  bodyBatteryHighestValue?: number;
  bodyBatteryHighValue?: number;
  bodyBatteryLowestValue?: number;
  bodyBatteryLowValue?: number;
  bodyBatteryChargedValue?: number;
  bodyBatteryDrainedValue?: number;
  restingHeartRateInBeatsPerMinute?: number;
  averageStressLevel?: number;
  [key: string]: unknown;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function coerceDailySummary(raw: unknown): DailySummary | null {
  if (!isRecord(raw)) return null;
  const callbackURL = raw.callbackURL;
  if (typeof callbackURL === 'string' && callbackURL.length > 0) {
    return null;
  }
  return raw as DailySummary;
}

function dailySortKey(d: DailySummary): number {
  const cd = parseGarminCalendarDate(d.calendarDate);
  if (cd) return cd.getTime();
  return 0;
}

function latestDailyInBatch(items: DailySummary[]): DailySummary | null {
  let best: DailySummary | null = null;
  let bestKey = -Infinity;
  for (const d of items) {
    const k = dailySortKey(d);
    if (k >= bestKey) {
      bestKey = k;
      best = d;
    }
  }
  return best;
}

export async function handleDailySummary(
  dailyItems: unknown[],
  userId?: string
): Promise<{ processed: number; skipped: number; errors: number }> {
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  const byGarminUser = new Map<string, DailySummary[]>();

  for (const raw of dailyItems) {
    const d = coerceDailySummary(raw);
    if (!d) {
      skipped++;
      continue;
    }
    const gid = userId ?? (typeof d.userId === 'string' ? d.userId : undefined);
    if (!gid) {
      console.warn('⚠️ No userId in daily summary');
      skipped++;
      continue;
    }
    let arr = byGarminUser.get(gid);
    if (!arr) {
      arr = [];
      byGarminUser.set(gid, arr);
    }
    arr.push(d);
  }

  for (const [garminUserId, batch] of byGarminUser) {
    try {
      const athlete = await getAthleteByGarminUserId(garminUserId);
      if (!athlete) {
        console.warn(`⚠️ Athlete not found for Garmin userId (daily): ${garminUserId}`);
        skipped += batch.length;
        continue;
      }

      const winner = latestDailyInBatch(batch);
      if (!winner) {
        skipped += batch.length;
        continue;
      }

      await upsertGarminHealthRecord(athlete.id, HEALTH_TYPE_DAILY, winner as Record<string, unknown>);

      console.log('✅ athlete_health_records daily upserted', {
        athleteId: athlete.id,
        garminUserId,
        calendarDate: winner.calendarDate ?? null,
        summaryId: winner.summaryId ?? null,
      });

      processed++;
    } catch (err: unknown) {
      errors++;
      console.error(`❌ Error processing daily for Garmin user ${garminUserId}:`, err);
    }
  }

  return { processed, skipped, errors };
}
