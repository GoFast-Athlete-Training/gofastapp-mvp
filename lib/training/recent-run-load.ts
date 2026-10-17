/**
 * Source-agnostic recent run load from athlete_activities (Garmin today; Strava-compatible columns later).
 */

import { prisma } from "@/lib/prisma";
import { utcDateOnly } from "@/lib/training/plan-utils";

const METERS_PER_MILE = 1609.34;

export type RecentRunDaySummary = {
  dateKey: string;
  source: string;
  activityName: string | null;
  distanceMiles: number | null;
  durationMinutes: number | null;
  avgPaceSecPerMile: number | null;
};

export type RecentRunLoadSummary = {
  days: RecentRunDaySummary[];
  totalMilesLast7: number;
};

function paceSecPerMileFromActivity(distance: number | null, durationSec: number | null): number | null {
  if (distance == null || durationSec == null || distance <= 0 || durationSec <= 0) return null;
  const miles = distance / METERS_PER_MILE;
  if (miles <= 0) return null;
  return durationSec / miles;
}

function isRunLike(activityType: string | null): boolean {
  if (!activityType) return true;
  const t = activityType.toLowerCase();
  return t.includes("run") || t.includes("trail") || t.includes("track");
}

/**
 * Summarize run-like activities in the window ending on `asOfDateKey` (UTC calendar day).
 */
export async function loadRecentRunLoad(params: {
  athleteId: string;
  asOfDateKey: string;
  lookbackDays?: number;
}): Promise<RecentRunLoadSummary> {
  const lookback = Math.min(14, Math.max(1, params.lookbackDays ?? 7));
  const end = utcDateOnly(new Date(`${params.asOfDateKey}T12:00:00.000Z`));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - lookback);
  start.setUTCHours(0, 0, 0, 0);

  const rows = await prisma.athlete_activities.findMany({
    where: {
      athleteId: params.athleteId,
      startTime: { gte: start, lte: end },
    },
    orderBy: { startTime: "desc" },
    select: {
      source: true,
      activityName: true,
      activityType: true,
      startTime: true,
      distance: true,
      duration: true,
      averageSpeed: true,
    },
    take: 40,
  });

  const days: RecentRunDaySummary[] = [];
  let totalMilesLast7 = 0;

  for (const row of rows) {
    if (!isRunLike(row.activityType)) continue;
    if (!row.startTime) continue;
    const dateKey = utcDateOnly(row.startTime).toISOString().slice(0, 10);
    const distanceMiles =
      row.distance != null && row.distance > 0
        ? Math.round((row.distance / METERS_PER_MILE) * 100) / 100
        : null;
    const durationMinutes =
      row.duration != null && row.duration > 0 ? Math.round(row.duration / 60) : null;

    let avgPaceSecPerMile = paceSecPerMileFromActivity(row.distance, row.duration);
    if (avgPaceSecPerMile == null && row.averageSpeed != null && row.averageSpeed > 0) {
      const mph = row.averageSpeed * 2.23694;
      if (mph > 0) avgPaceSecPerMile = 3600 / mph;
    }

    if (distanceMiles != null) totalMilesLast7 += distanceMiles;

    days.push({
      dateKey,
      source: row.source,
      activityName: row.activityName,
      distanceMiles,
      durationMinutes,
      avgPaceSecPerMile,
    });
  }

  return { days, totalMilesLast7: Math.round(totalMilesLast7 * 10) / 10 };
}
