/**
 * Handle Garmin wellness sleep push / fetch results.
 * Stores the latest night on Athlete.garmin_user_sleep (by calendarDate).
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { getAthleteByGarminUserId } from '../domain-garmin';

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

/** Lexicographic compare works for YYYY-MM-DD; fallback to startTimeInSeconds. */
function sleepSortKey(s: SleepSummary): number {
  const cd = s.calendarDate;
  if (typeof cd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(cd)) {
    return Date.parse(`${cd}T12:00:00Z`);
  }
  const sec = s.startTimeInSeconds;
  if (typeof sec === 'number' && Number.isFinite(sec)) {
    return sec * 1000;
  }
  return 0;
}

function readStoredCalendarDateMs(stored: unknown): number {
  if (!isRecord(stored)) return 0;
  const cd = stored.calendarDate;
  if (typeof cd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(cd)) {
    const t = Date.parse(`${cd}T12:00:00Z`);
    return Number.isFinite(t) ? t : 0;
  }
  const sec = stored.startTimeInSeconds;
  if (typeof sec === 'number' && Number.isFinite(sec)) {
    return sec * 1000;
  }
  return 0;
}

/**
 * Pick the latest sleep row from a batch for one Garmin user id.
 */
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

/**
 * Process sleep summaries from webhook inline payload or fetched JSON array.
 */
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

      const incomingMs = sleepSortKey(winner);
      const storedMs = readStoredCalendarDateMs(athlete.garmin_user_sleep);

      if (incomingMs < storedMs) {
        skipped += batch.length;
        continue;
      }

      await prisma.athlete.update({
        where: { id: athlete.id },
        data: {
          garmin_user_sleep: winner as unknown as Prisma.InputJsonValue,
          garmin_last_sync_at: new Date(),
        },
      });

      console.log('✅ garmin_user_sleep updated', {
        athleteId: athlete.id,
        garminUserId,
        calendarDate: winner.calendarDate ?? null,
      });

      processed++;
    } catch (err: unknown) {
      errors++;
      console.error(`❌ Error processing sleep for Garmin user ${garminUserId}:`, err);
    }
  }

  return { processed, skipped, errors };
}
