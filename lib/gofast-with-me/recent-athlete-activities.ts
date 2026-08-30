import { prisma } from '@/lib/prisma';

const METERS_PER_MILE = 1609.344;

export type RecentAthleteActivityPayload = {
  id: string;
  activityName: string | null;
  activityType: string | null;
  startTime: string | null;
  distanceMiles: number | null;
  durationSeconds: number | null;
  source: string | null;
  summaryPolyline: string | null;
};

export async function listRecentAthleteActivities(
  athleteId: string,
  limit = 5
): Promise<RecentAthleteActivityPayload[]> {
  const rows = await prisma.athlete_activities.findMany({
    where: { athleteId },
    orderBy: [{ startTime: 'desc' }, { id: 'desc' }],
    take: limit,
    select: {
      id: true,
      activityName: true,
      activityType: true,
      startTime: true,
      distance: true,
      duration: true,
      source: true,
      summaryPolyline: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    activityName: row.activityName,
    activityType: row.activityType,
    startTime: row.startTime?.toISOString() ?? null,
    distanceMiles:
      row.distance != null && row.distance > 0 ? row.distance / METERS_PER_MILE : null,
    durationSeconds: row.duration,
    source: row.source ?? null,
    summaryPolyline: row.summaryPolyline ?? null,
  }));
}
