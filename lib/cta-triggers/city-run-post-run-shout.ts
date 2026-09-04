import { prisma } from '@/lib/prisma';
import { hasSocialRunLifecycle, isIndividualHostedRun } from '@/lib/city-run-type';
import { RSVP_ROLE_HOST } from '@/lib/city-run/rsvp-role';
import {
  isCityRunPast,
  isCityRunWithinPostRunCheckinWindow,
  RUN_PAST_BUFFER_MS,
} from '@/lib/city-run-clock';

export { RUN_PAST_BUFFER_MS };

/** Post-run check-in / shout CTA only surfaces for this long after the trigger moment. */
export const POST_RUN_CTA_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const LOOKBACK_MS = POST_RUN_CTA_MAX_AGE_MS;

type RunClockRow = {
  date: Date;
  startTimeHour?: number | null;
  startTimeMinute?: number | null;
  startTimePeriod?: string | null;
  timezone?: string | null;
};

function runClock(run: RunClockRow) {
  return {
    date: run.date,
    startTimeHour: run.startTimeHour,
    startTimeMinute: run.startTimeMinute,
    startTimePeriod: run.startTimePeriod,
    timezone: run.timezone,
  };
}

/** RSVP check-in prompt: run ended recently enough to still nudge check-in. */
export function isRunWithinPostRunCheckinCtaWindow(
  run: RunClockRow,
  nowMs = Date.now()
): boolean {
  return isCityRunWithinPostRunCheckinWindow(runClock(run), nowMs);
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

const RUN_CLOCK_SELECT = {
  id: true,
  title: true,
  date: true,
  startTimeHour: true,
  startTimeMinute: true,
  startTimePeriod: true,
  timezone: true,
  cityRunType: true,
  runClubId: true,
  athleteGeneratedId: true,
  runClub: { select: RUN_CLUB_SELECT },
} as const;

export type CityRunPostRunShoutCta = {
  type: 'cityRunPostRunShoutCta';
  runId: string;
  runTitle: string;
  runDate: string;
  cityRunType?: string | null;
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
  ctaTarget: 'checkin' | 'shouts' | 'view-run';
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
      city_runs: { select: RUN_CLOCK_SELECT },
    },
    orderBy: { checkedInAt: 'desc' },
  });

  for (const checkin of checkins) {
    const run = checkin.city_runs;
    if (!run || !hasSocialRunLifecycle(run) || !isCityRunPast(runClock(run))) continue;
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

    const isIndividual = isIndividualHostedRun(run);
    const ctaTarget = isIndividual ? 'view-run' : 'shouts';

    return {
      type: 'cityRunPostRunShoutCta',
      runId: run.id,
      runTitle: run.title,
      runDate: run.date.toISOString(),
      cityRunType: run.cityRunType,
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
      ctaTarget,
    };
  }

  const goingRsvps = await prisma.city_run_rsvps.findMany({
    where: {
      athleteId,
      status: 'going',
      NOT: { role: RSVP_ROLE_HOST },
      city_runs: {
        date: { gte: since },
      },
    },
    include: {
      city_runs: { select: RUN_CLOCK_SELECT },
    },
  });

  const sortedGoingRsvps = goingRsvps.sort(
    (a, b) => b.city_runs.date.getTime() - a.city_runs.date.getTime()
  );

  for (const rsvp of sortedGoingRsvps) {
    const run = rsvp.city_runs;
    if (!run || !hasSocialRunLifecycle(run) || !isCityRunPast(runClock(run))) continue;
    if (!isRunWithinPostRunCheckinCtaWindow(run)) continue;

    const existingCheckin = await prisma.city_run_checkins.findUnique({
      where: { runId_athleteId: { runId: run.id, athleteId } },
    });
    if (existingCheckin) continue;

    const iRanStamp = await prisma.planned_workouts.findFirst({
      where: { athleteId, cityRunId: run.id },
      select: { iRanAt: true, iRanDeclined: true },
    });
    if (iRanStamp?.iRanAt || iRanStamp?.iRanDeclined) continue;

    const activityLink = await prisma.city_run_activity_links.findUnique({
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

    const isIndividual = isIndividualHostedRun(run);
    const garminLinked = Boolean(activityLink?.activityId);

    if (garminLinked && isIndividual) {
      return {
        type: 'cityRunPostRunShoutCta',
        runId: run.id,
        runTitle: run.title,
        runDate: run.date.toISOString(),
        cityRunType: run.cityRunType,
        runClub: run.runClub,
        hasCheckin: false,
        checkedInAt: null,
        hasShout: false,
        garminLinked: true,
        activitySummary: activityLink?.athlete_activities
          ? {
              id: activityLink.athlete_activities.id,
              activityName: activityLink.athlete_activities.activityName,
              startTime: activityLink.athlete_activities.startTime?.toISOString() ?? null,
              distanceMeters: activityLink.athlete_activities.distance ?? null,
            }
          : null,
        ctaTarget: 'view-run',
      };
    }

    return {
      type: 'cityRunPostRunShoutCta',
      runId: run.id,
      runTitle: run.title,
      runDate: run.date.toISOString(),
      cityRunType: run.cityRunType,
      runClub: run.runClub,
      hasCheckin: false,
      checkedInAt: null,
      hasShout: false,
      garminLinked,
      activitySummary: activityLink?.athlete_activities
        ? {
            id: activityLink.athlete_activities.id,
            activityName: activityLink.athlete_activities.activityName,
            startTime: activityLink.athlete_activities.startTime?.toISOString() ?? null,
            distanceMeters: activityLink.athlete_activities.distance ?? null,
          }
        : null,
      ctaTarget: 'checkin',
    };
  }

  return null;
}
