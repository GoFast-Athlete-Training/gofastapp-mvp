import { prisma } from '@/lib/prisma';
import { RUNNING_ACTIVITY_TYPES } from '@/lib/training/activity-type-sets';
import { extractGarminWorkoutIdFromSummary } from '@/lib/training/extract-garmin-workout-id';
import { getCityRunStartMs } from '@/lib/city-run-clock';

const CITY_RUN_MATCH_WINDOW_MS = 36 * 60 * 60 * 1000;

export type CityRunActivityMatchResult = {
  linked: boolean;
  cityRunId?: string;
  runClubSlug?: string | null;
  autoCheckin?: boolean;
  credited?: boolean;
};

function isRunningActivityType(activityType: string | null | undefined): boolean {
  if (!activityType) return true;
  return RUNNING_ACTIVITY_TYPES.has(activityType.toUpperCase());
}

function generateLinkId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

function generateCheckinId() {
  return generateLinkId();
}

function runAnchorMs(
  runDate: Date,
  startTimeHour: number | null,
  startTimeMinute: number | null,
  startTimePeriod: string | null
): number {
  return getCityRunStartMs({
    date: runDate,
    startTimeHour,
    startTimeMinute,
    startTimePeriod,
  });
}

function normalizeLabel(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function labelMatchesActivity(label: string | null | undefined, activityName: string | null | undefined): boolean {
  const needle = normalizeLabel(label);
  const haystack = normalizeLabel(activityName);
  if (!needle || !haystack) return false;
  return haystack.includes(needle) || needle.includes(haystack);
}

async function creditCityRunFromStamp(params: {
  athleteId: string;
  cityRunId: string;
  activityId: string;
  runClubSlug: string | null;
}): Promise<CityRunActivityMatchResult> {
  const existingLink = await prisma.city_run_activity_links.findUnique({
    where: {
      cityRunId_athleteId: { cityRunId: params.cityRunId, athleteId: params.athleteId },
    },
  });

  if (existingLink?.activityId) {
    return {
      linked: false,
      cityRunId: params.cityRunId,
      runClubSlug: params.runClubSlug,
    };
  }

  const existingCheckin = await prisma.city_run_checkins.findUnique({
    where: { runId_athleteId: { runId: params.cityRunId, athleteId: params.athleteId } },
  });

  if (!existingCheckin) {
    await prisma.city_run_checkins.create({
      data: {
        id: generateCheckinId(),
        runId: params.cityRunId,
        athleteId: params.athleteId,
        checkedInAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  await prisma.city_run_activity_links.upsert({
    where: { cityRunId_athleteId: { cityRunId: params.cityRunId, athleteId: params.athleteId } },
    update: {
      activityId: params.activityId,
      linkedManually: false,
    },
    create: {
      id: generateLinkId(),
      cityRunId: params.cityRunId,
      athleteId: params.athleteId,
      activityId: params.activityId,
      linkedManually: false,
    },
  });

  console.log('✅ city run stamp credited via activity match', {
    activityId: params.activityId,
    cityRunId: params.cityRunId,
    athleteId: params.athleteId,
    autoCheckin: !existingCheckin,
  });

  return {
    linked: true,
    cityRunId: params.cityRunId,
    runClubSlug: params.runClubSlug,
    autoCheckin: !existingCheckin,
    credited: true,
  };
}

async function matchStampedPlannedWorkout(
  activity: {
    id: string;
    athleteId: string;
    activityName: string | null;
    startTime: Date | null;
    summaryData: unknown;
  }
): Promise<CityRunActivityMatchResult | null> {
  if (!activity.startTime) return null;

  const garminWorkoutId = extractGarminWorkoutIdFromSummary(activity.summaryData);
  const activityStartMs = activity.startTime.getTime();
  const activityDayStart = new Date(activity.startTime);
  activityDayStart.setUTCHours(0, 0, 0, 0);
  const activityDayEnd = new Date(activityDayStart);
  activityDayEnd.setUTCDate(activityDayEnd.getUTCDate() + 1);

  const stamps = await prisma.planned_workouts.findMany({
    where: {
      athleteId: activity.athleteId,
      cityRunId: { not: null },
      date: { gte: activityDayStart, lt: activityDayEnd },
    },
    include: {
      city_run: {
        select: {
          id: true,
          date: true,
          startTimeHour: true,
          startTimeMinute: true,
          startTimePeriod: true,
          runClub: { select: { slug: true } },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (stamps.length === 0) return null;

  let candidates = stamps;

  if (garminWorkoutId != null) {
    const byGarmin = stamps.filter((s) => s.garminWorkoutId === garminWorkoutId);
    if (byGarmin.length === 1) {
      const stamp = byGarmin[0];
      if (stamp.cityRunId && stamp.city_run) {
        return creditCityRunFromStamp({
          athleteId: activity.athleteId,
          cityRunId: stamp.cityRunId,
          activityId: activity.id,
          runClubSlug: stamp.city_run.runClub?.slug ?? null,
        });
      }
    }
    if (byGarmin.length > 1) {
      console.log('city-run stamp match skipped: ambiguous garminWorkoutId', {
        activityId: activity.id,
        garminWorkoutId,
      });
      return null;
    }
  }

  const byLabel = candidates.filter((s) =>
    labelMatchesActivity(s.cityRunMatchLabel, activity.activityName)
  );
  if (byLabel.length === 1 && byLabel[0].cityRunId && byLabel[0].city_run) {
    return creditCityRunFromStamp({
      athleteId: activity.athleteId,
      cityRunId: byLabel[0].cityRunId,
      activityId: activity.id,
      runClubSlug: byLabel[0].city_run.runClub?.slug ?? null,
    });
  }
  if (byLabel.length > 1) {
    console.log('city-run stamp match skipped: ambiguous label', {
      activityId: activity.id,
      labels: byLabel.map((s) => s.cityRunMatchLabel),
    });
    return null;
  }

  const timeCandidates = candidates.filter((stamp) => {
    const run = stamp.city_run;
    if (!run) return false;
    const anchorMs = runAnchorMs(
      run.date,
      run.startTimeHour,
      run.startTimeMinute,
      run.startTimePeriod
    );
    return Math.abs(anchorMs - activityStartMs) <= CITY_RUN_MATCH_WINDOW_MS;
  });

  if (timeCandidates.length === 1 && timeCandidates[0].cityRunId && timeCandidates[0].city_run) {
    return creditCityRunFromStamp({
      athleteId: activity.athleteId,
      cityRunId: timeCandidates[0].cityRunId,
      activityId: activity.id,
      runClubSlug: timeCandidates[0].city_run.runClub?.slug ?? null,
    });
  }

  if (timeCandidates.length > 1) {
    console.log('city-run stamp match skipped: ambiguous time window', {
      activityId: activity.id,
      candidateRunIds: timeCandidates.map((s) => s.cityRunId),
    });
  }

  return null;
}

/**
 * After Garmin ingest: credit club City Run stamps first (auto check-in + link),
 * then fall back to check-in-first linking for legacy flows.
 */
export async function tryMatchActivityToCityRun(
  activityId: string
): Promise<CityRunActivityMatchResult> {
  const activity = await prisma.athlete_activities.findUnique({
    where: { id: activityId },
  });

  if (!activity?.startTime || !isRunningActivityType(activity.activityType)) {
    return { linked: false };
  }

  const stampMatch = await matchStampedPlannedWorkout(activity);
  if (stampMatch) {
    return stampMatch;
  }

  const activityStartMs = activity.startTime.getTime();

  const checkins = await prisma.city_run_checkins.findMany({
    where: {
      athleteId: activity.athleteId,
      checkedInAt: {
        gte: new Date(activityStartMs - 7 * 24 * 60 * 60 * 1000),
      },
    },
    include: {
      city_runs: {
        select: {
          id: true,
          date: true,
          startTimeHour: true,
          startTimeMinute: true,
          startTimePeriod: true,
          runClub: { select: { slug: true } },
        },
      },
    },
    orderBy: { checkedInAt: 'desc' },
  });

  const candidates = checkins.filter((checkin) => {
    const run = checkin.city_runs;
    if (!run) return false;
    const anchorMs = runAnchorMs(
      run.date,
      run.startTimeHour,
      run.startTimeMinute,
      run.startTimePeriod
    );
    return Math.abs(anchorMs - activityStartMs) <= CITY_RUN_MATCH_WINDOW_MS;
  });

  if (candidates.length !== 1) {
    if (candidates.length > 1) {
      console.log('city-run activity match skipped: ambiguous check-in candidates', {
        activityId,
        candidateRunIds: candidates.map((c) => c.runId),
      });
    }
    return { linked: false };
  }

  const cityRunId = candidates[0].runId;
  const runClubSlug = candidates[0].city_runs?.runClub?.slug ?? null;

  const existingLink = await prisma.city_run_activity_links.findUnique({
    where: { cityRunId_athleteId: { cityRunId, athleteId: activity.athleteId } },
  });

  if (existingLink?.activityId) {
    return { linked: false, cityRunId, runClubSlug };
  }

  await prisma.city_run_activity_links.upsert({
    where: { cityRunId_athleteId: { cityRunId, athleteId: activity.athleteId } },
    update: {
      activityId,
      linkedManually: false,
    },
    create: {
      id: generateLinkId(),
      cityRunId,
      athleteId: activity.athleteId,
      activityId,
      linkedManually: false,
    },
  });

  console.log('✅ city_run_activity_links auto-linked (check-in first)', {
    activityId,
    cityRunId,
    athleteId: activity.athleteId,
  });

  return { linked: true, cityRunId, runClubSlug };
}
