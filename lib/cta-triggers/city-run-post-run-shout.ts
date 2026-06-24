import { prisma } from '@/lib/prisma';
import { isClubRun } from '@/lib/city-run-type';

export const RUN_PAST_BUFFER_MS = 4 * 60 * 60 * 1000;
/** Post-run check-in / shout CTA only surfaces for this long after the trigger moment. */
export const POST_RUN_CTA_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const LOOKBACK_MS = POST_RUN_CTA_MAX_AGE_MS;

function isRunPast(date: Date, nowMs = Date.now()): boolean {
  return date.getTime() + RUN_PAST_BUFFER_MS < nowMs;
}

/** RSVP check-in prompt: run ended recently enough to still nudge check-in. */
export function isRunWithinPostRunCheckinCtaWindow(
  runDate: Date,
  nowMs = Date.now()
): boolean {
  const runPastAt = runDate.getTime() + RUN_PAST_BUFFER_MS;
  if (nowMs < runPastAt) return false;
  return nowMs - runPastAt <= POST_RUN_CTA_MAX_AGE_MS;
}

/** Shout prompt after check-in: only fresh for 24h from check-in time. */
export function isCheckinWithinPostRunShoutCtaWindow(
  checkedInAt: Date,
  nowMs = Date.now()
): boolean {
  return nowMs - checkedInAt.getTime() <= POST_RUN_CTA_MAX_AGE_MS;
}

const RUN_CLUB_SELECT = {
  id: true,
  slug: true,
  name: true,
  logoUrl: true,
  city: true,
} as const;

export type CityRunPostRunShoutCta = {
  type: 'cityRunPostRunShoutCta';
  runId: string;
  runTitle: string;
  runDate: string;
  runClub: {
    id: string;
    slug: string;
    name: string;
    logoUrl: string | null;
    city: string | null;
  } | null;
  hasCheckin: boolean;
  checkedInAt: string | null;
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
          cityRunType: true,
          runClubId: true,
          runClub: { select: RUN_CLUB_SELECT },
        },
      },
    },
    orderBy: { checkedInAt: 'desc' },
  });

  for (const checkin of checkins) {
    const run = checkin.city_runs;
    if (!run || !isClubRun(run) || !isRunPast(run.date)) continue;
    if (!isCheckinWithinPostRunShoutCtaWindow(checkin.checkedInAt)) continue;
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
      runClub: run.runClub,
      hasCheckin: true,
      checkedInAt: checkin.checkedInAt.toISOString(),
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
          cityRunType: true,
          runClubId: true,
          runClub: { select: RUN_CLUB_SELECT },
        },
      },
    },
  });

  const sortedGoingRsvps = goingRsvps.sort(
    (a, b) => b.city_runs.date.getTime() - a.city_runs.date.getTime()
  );

  for (const rsvp of sortedGoingRsvps) {
    const run = rsvp.city_runs;
    if (!run || !isClubRun(run) || !isRunPast(run.date)) continue;
    if (!isRunWithinPostRunCheckinCtaWindow(run.date)) continue;

    const existingCheckin = await prisma.city_run_checkins.findUnique({
      where: { runId_athleteId: { runId: run.id, athleteId } },
    });
    if (existingCheckin) continue;

    return {
      type: 'cityRunPostRunShoutCta',
      runId: run.id,
      runTitle: run.title,
      runDate: run.date.toISOString(),
      runClub: run.runClub,
      hasCheckin: false,
      checkedInAt: null,
      hasShout: false,
      garminLinked: false,
      activitySummary: null,
      ctaTarget: 'checkin',
    };
  }

  return null;
}
