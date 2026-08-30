import { prisma } from '@/lib/prisma';
import { isGenericGarminActivityName } from '@/lib/garmin-events/generic-activity-names';
import { isRunningActivityType } from '@/lib/training/activity-type-sets';

const METERS_PER_MILE = 1609.344;
const FETCH_BATCH = 40;

export type HubMatchedWorkoutPayload = {
  id: string;
  title: string;
  workoutType: string;
  planName: string | null;
  workoutDate: string | null;
  publicTitle: string | null;
  reflection: string | null;
  workoutPhotoUrl: string | null;
};

export type RecentAthleteActivityPayload = {
  id: string;
  activityName: string | null;
  activityType: string | null;
  startTime: string | null;
  distanceMiles: number | null;
  durationSeconds: number | null;
  source: string | null;
  summaryPolyline: string | null;
  startLatitude: number | null;
  startLongitude: number | null;
  endLatitude: number | null;
  endLongitude: number | null;
  matchedWorkout: HubMatchedWorkoutPayload | null;
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameCalendarDay(iso: string | null | undefined, day: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  d.setHours(0, 0, 0, 0);
  return d.getTime() === day.getTime();
}

export function sortRunningActivitiesForHub(
  activities: RecentAthleteActivityPayload[]
): RecentAthleteActivityPayload[] {
  const today = startOfToday();
  return [...activities].sort((a, b) => {
    const aTodayMatch =
      a.matchedWorkout != null && isSameCalendarDay(a.matchedWorkout.workoutDate, today);
    const bTodayMatch =
      b.matchedWorkout != null && isSameCalendarDay(b.matchedWorkout.workoutDate, today);
    if (aTodayMatch !== bTodayMatch) return aTodayMatch ? -1 : 1;

    const aMatched = a.matchedWorkout != null;
    const bMatched = b.matchedWorkout != null;
    if (aMatched !== bMatched) return aMatched ? -1 : 1;

    return (b.startTime ?? '').localeCompare(a.startTime ?? '');
  });
}

function mapRow(row: {
  id: string;
  activityName: string | null;
  activityType: string | null;
  startTime: Date | null;
  distance: number | null;
  duration: number | null;
  source: string | null;
  summaryPolyline: string | null;
  startLatitude: number | null;
  startLongitude: number | null;
  endLatitude: number | null;
  endLongitude: number | null;
  matched_workout: {
    id: string;
    title: string;
    workoutType: string;
    date: Date | null;
    publicTitle: string | null;
    reflection: string | null;
    workoutPhotoUrl: string | null;
    training_plans: { name: string } | null;
  } | null;
}): RecentAthleteActivityPayload {
  const matched = row.matched_workout;
  return {
    id: row.id,
    activityName: row.activityName,
    activityType: row.activityType,
    startTime: row.startTime?.toISOString() ?? null,
    distanceMiles:
      row.distance != null && row.distance > 0 ? row.distance / METERS_PER_MILE : null,
    durationSeconds: row.duration,
    source: row.source ?? null,
    summaryPolyline: row.summaryPolyline ?? null,
    startLatitude: row.startLatitude ?? null,
    startLongitude: row.startLongitude ?? null,
    endLatitude: row.endLatitude ?? null,
    endLongitude: row.endLongitude ?? null,
    matchedWorkout: matched
      ? {
          id: matched.id,
          title: matched.title,
          workoutType: matched.workoutType,
          planName: matched.training_plans?.name ?? null,
          workoutDate: matched.date?.toISOString() ?? null,
          publicTitle: matched.publicTitle ?? null,
          reflection: matched.reflection ?? null,
          workoutPhotoUrl: matched.workoutPhotoUrl ?? null,
        }
      : null,
  };
}

export async function listRecentAthleteActivities(
  athleteId: string,
  limit = 5
): Promise<RecentAthleteActivityPayload[]> {
  const rows = await prisma.athlete_activities.findMany({
    where: { athleteId },
    orderBy: [{ startTime: 'desc' }, { id: 'desc' }],
    take: FETCH_BATCH,
    select: {
      id: true,
      activityName: true,
      activityType: true,
      startTime: true,
      distance: true,
      duration: true,
      source: true,
      summaryPolyline: true,
      startLatitude: true,
      startLongitude: true,
      endLatitude: true,
      endLongitude: true,
      matched_workout: {
        select: {
          id: true,
          title: true,
          workoutType: true,
          date: true,
          publicTitle: true,
          reflection: true,
          workoutPhotoUrl: true,
          training_plans: { select: { name: true } },
        },
      },
    },
  });

  const filtered = rows
    .filter(
      (row) =>
        isRunningActivityType(row.activityType) && !isGenericGarminActivityName(row.activityName)
    )
    .map(mapRow);

  return sortRunningActivitiesForHub(filtered).slice(0, limit);
}
