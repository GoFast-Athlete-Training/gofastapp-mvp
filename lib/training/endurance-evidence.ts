/**
 * Load recent sustained long-distance running efforts for race-readiness triangulation.
 */

import { prisma } from "@/lib/prisma";
import { metersToMiles } from "@/lib/pace-utils";
import { RUNNING_ACTIVITY_TYPES } from "@/lib/training/activity-type-sets";
import {
  formatSecPerMile,
  type LongEffortEvidenceSummary,
  longEffortTierFromMiles,
} from "@/lib/training/race-projection";

export const DEFAULT_LOOKBACK_DAYS = 90;
export const MIN_LONG_EFFORT_MILES = 10;
export const HALF_HOLD_MILES_MIN = 12.5;

function isRunningActivity(activityType: string | null | undefined): boolean {
  if (!activityType?.trim()) return true;
  return RUNNING_ACTIVITY_TYPES.has(activityType.trim().toUpperCase());
}

function raceLikeScore(activityName: string | null | undefined): number {
  const n = (activityName ?? "").toLowerCase();
  if (/\b(race|marathon|half|tempo|time trial|tt)\b/.test(n)) return 2;
  if (/\b(long run|longrun|workout)\b/.test(n)) return 1;
  return 0;
}

function evidenceTierFromMiles(miles: number): LongEffortEvidenceSummary["tier"] {
  return longEffortTierFromMiles(miles);
}

function toEvidenceSummary(row: {
  id: string;
  activityName: string | null;
  startTime: Date | null;
  distance: number;
  duration: number;
  distanceMiles: number;
  avgPaceSecPerMile: number;
}): LongEffortEvidenceSummary {
  return {
    activityId: row.id,
    activityName: row.activityName,
    startTime: row.startTime?.toISOString() ?? null,
    distanceMiles: row.distanceMiles,
    durationSeconds: row.duration,
    avgPaceSecPerMile: row.avgPaceSecPerMile,
    avgPace: formatSecPerMile(row.avgPaceSecPerMile) ?? "",
    tier: evidenceTierFromMiles(row.distanceMiles),
  };
}

function scoreCandidate(row: {
  distanceMiles: number;
  startTime: Date | null;
  activityName: string | null;
}): number {
  let score = 0;
  if (row.distanceMiles >= 16) score += 400;
  else if (row.distanceMiles >= HALF_HOLD_MILES_MIN) score += 300;
  else if (row.distanceMiles >= MIN_LONG_EFFORT_MILES) score += 200;

  score += raceLikeScore(row.activityName) * 25;
  score += Math.min(90, row.distanceMiles * 3);

  if (row.startTime) {
    const daysAgo = (Date.now() - row.startTime.getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 90 - daysAgo);
  }

  return score;
}

/**
 * Best recent sustained run for marathon/half readiness (10+ mi in lookback window).
 */
export async function loadRecentLongEffortEvidence(
  athleteId: string,
  options?: { lookbackDays?: number; minMiles?: number }
): Promise<LongEffortEvidenceSummary | null> {
  const lookbackDays = options?.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const minMiles = options?.minMiles ?? MIN_LONG_EFFORT_MILES;
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  const activities = await prisma.athlete_activities.findMany({
    where: {
      athleteId,
      startTime: { gte: since },
      distance: { gt: minMiles * 1609.344 * 0.95 },
      duration: { gt: 0 },
    },
    select: {
      id: true,
      activityName: true,
      activityType: true,
      startTime: true,
      distance: true,
      duration: true,
    },
    orderBy: { startTime: "desc" },
    take: 40,
  });

  let best: {
    id: string;
    activityName: string | null;
    startTime: Date | null;
    distance: number;
    duration: number;
    distanceMiles: number;
    avgPaceSecPerMile: number;
    score: number;
  } | null = null;

  for (const a of activities) {
    if (!isRunningActivity(a.activityType)) continue;
    if (a.distance == null || a.duration == null || a.distance <= 0 || a.duration <= 0) {
      continue;
    }

    const distanceMiles = metersToMiles(a.distance);
    if (distanceMiles < minMiles) continue;

    const avgPaceSecPerMile = Math.round(a.duration / distanceMiles);
    if (!Number.isFinite(avgPaceSecPerMile) || avgPaceSecPerMile <= 0) continue;

    const score = scoreCandidate({
      distanceMiles,
      startTime: a.startTime,
      activityName: a.activityName,
    });

    if (!best || score > best.score) {
      best = {
        id: a.id,
        activityName: a.activityName,
        startTime: a.startTime,
        distance: a.distance,
        duration: a.duration,
        distanceMiles,
        avgPaceSecPerMile,
        score,
      };
    }
  }

  return best ? toEvidenceSummary(best) : null;
}
