import { prisma } from '@/lib/prisma';
import { RUNNING_ACTIVITY_TYPES } from '@/lib/training/activity-type-sets';

const CITY_RUN_MATCH_WINDOW_MS = 36 * 60 * 60 * 1000;

function isRunningActivityType(activityType: string | null | undefined): boolean {
  if (!activityType) return true;
  return RUNNING_ACTIVITY_TYPES.has(activityType.toUpperCase());
}

function generateLinkId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

function runAnchorMs(runDate: Date, startTimeHour: number | null, startTimeMinute: number | null): number {
  const anchor = new Date(runDate);
  if (startTimeHour != null && startTimeMinute != null) {
    anchor.setUTCHours(startTimeHour, startTimeMinute, 0, 0);
  }
  return anchor.getTime();
}

/**
 * After Garmin ingest: link activity to a checked-in city run when exactly one candidate fits.
 */
export async function tryMatchActivityToCityRun(
  activityId: string
): Promise<{ linked: boolean; cityRunId?: string }> {
  const activity = await prisma.athlete_activities.findUnique({
    where: { id: activityId },
  });

  if (!activity?.startTime || !isRunningActivityType(activity.activityType)) {
    return { linked: false };
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
        },
      },
    },
    orderBy: { checkedInAt: 'desc' },
  });

  const candidates = checkins.filter((checkin) => {
    const run = checkin.city_runs;
    if (!run) return false;
    const anchorMs = runAnchorMs(run.date, run.startTimeHour, run.startTimeMinute);
    return Math.abs(anchorMs - activityStartMs) <= CITY_RUN_MATCH_WINDOW_MS;
  });

  if (candidates.length !== 1) {
    if (candidates.length > 1) {
      console.log('city-run activity match skipped: ambiguous candidates', {
        activityId,
        candidateRunIds: candidates.map((c) => c.runId),
      });
    }
    return { linked: false };
  }

  const cityRunId = candidates[0].runId;

  const existingLink = await prisma.city_run_activity_links.findUnique({
    where: { cityRunId_athleteId: { cityRunId, athleteId: activity.athleteId } },
  });

  if (existingLink?.activityId) {
    return { linked: false, cityRunId };
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

  console.log('✅ city_run_activity_links auto-linked', {
    activityId,
    cityRunId,
    athleteId: activity.athleteId,
  });

  return { linked: true, cityRunId };
}
