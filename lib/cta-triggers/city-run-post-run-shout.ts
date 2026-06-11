import { prisma } from '@/lib/prisma';

const RUN_PAST_BUFFER_MS = 4 * 60 * 60 * 1000;
const LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;

function isRunPast(date: Date): boolean {
  return date.getTime() + RUN_PAST_BUFFER_MS < Date.now();
}

export type CityRunPostRunShoutCta = {
  type: 'cityRunPostRunShoutCta';
  runId: string;
  runTitle: string;
  runDate: string;
  hasCheckin: boolean;
  hasShout: boolean;
  garminLinked: boolean;
  activitySummary: {
    id: string;
    activityName: string | null;
    startTime: string | null;
    distanceMeters: number | null;
  } | null;
  ctaTarget: 'checkin' | 'shouts';
};

export async function findCityRunPostRunShoutCta(
  athleteId: string
): Promise<CityRunPostRunShoutCta | null> {
  const since = new Date(Date.now() - LOOKBACK_MS);

  const checkins = await prisma.city_run_checkins.findMany({
    where: {
      athleteId,
      checkedInAt: { gte: since },
    },
    include: {
      city_runs: {
        select: {
          id: true,
          title: true,
          date: true,
        },
      },
    },
    orderBy: { checkedInAt: 'desc' },
  });

  for (const checkin of checkins) {
    const run = checkin.city_runs;
    if (!run || !isRunPast(run.date)) continue;
    if (checkin.runShouts?.trim()) continue;

    const link = await prisma.city_run_activity_links.findUnique({
      where: { cityRunId_athleteId: { cityRunId: run.id, athleteId } },
      include: {
        athlete_activities: {
          select: {
            id: true,
            activityName: true,
            startTime: true,
            distance: true,
          },
        },
      },
    });

    return {
      type: 'cityRunPostRunShoutCta',
      runId: run.id,
      runTitle: run.title,
      runDate: run.date.toISOString(),
      hasCheckin: true,
      hasShout: false,
      garminLinked: Boolean(link?.activityId),
      activitySummary: link?.athlete_activities
        ? {
            id: link.athlete_activities.id,
            activityName: link.athlete_activities.activityName,
            startTime: link.athlete_activities.startTime?.toISOString() ?? null,
            distanceMeters: link.athlete_activities.distance ?? null,
          }
        : null,
      ctaTarget: 'shouts',
    };
  }

  const goingRsvps = await prisma.city_run_rsvps.findMany({
    where: {
      athleteId,
      status: 'going',
      city_runs: {
        date: { gte: since },
      },
    },
    include: {
      city_runs: {
        select: {
          id: true,
          title: true,
          date: true,
        },
      },
    },
  });

  const sortedGoingRsvps = goingRsvps.sort(
    (a, b) => b.city_runs.date.getTime() - a.city_runs.date.getTime()
  );

  for (const rsvp of sortedGoingRsvps) {
    const run = rsvp.city_runs;
    if (!run || !isRunPast(run.date)) continue;

    const existingCheckin = await prisma.city_run_checkins.findUnique({
      where: { runId_athleteId: { runId: run.id, athleteId } },
    });
    if (existingCheckin) continue;

    return {
      type: 'cityRunPostRunShoutCta',
      runId: run.id,
      runTitle: run.title,
      runDate: run.date.toISOString(),
      hasCheckin: false,
      hasShout: false,
      garminLinked: false,
      activitySummary: null,
      ctaTarget: 'checkin',
    };
  }

  return null;
}
