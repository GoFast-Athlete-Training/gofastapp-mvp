import { prisma } from '@/lib/prisma';
import { isCityRunPast } from '@/lib/city-run-clock';
import { RSVP_ROLE_HOST } from '@/lib/city-run/rsvp-role';

export type PublicUpcomingRunCard = {
  id: string;
  slug: string | null;
  title: string;
  date: string;
  citySlug: string | null;
  /** Alias for contentpublic landing (`gofastCity`). */
  gofastCity: string;
  meetUpPoint: string | null;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  workoutId: string | null;
  mapImageUrl: string | null;
  routePhotos: string[];
  gorunPath: string;
  isHost: boolean;
  goingCount: number;
  goingAvatars: {
    id: string;
    firstName: string | null;
    gofastHandle: string | null;
    photoURL: string | null;
  }[];
};

/** Upcoming runs from going RSVPs (includes auto host RSVP on individual create). */
export async function listPublicUpcomingRunsForAthlete(
  athleteId: string,
  limit = 20
): Promise<PublicUpcomingRunCard[]> {
  const nowMs = Date.now();
  const rsvps = await prisma.city_run_rsvps.findMany({
    where: {
      athleteId,
      status: 'going',
      city_runs: { published: true },
    },
    include: {
      city_runs: {
        select: {
          id: true,
          slug: true,
          title: true,
          date: true,
          citySlug: true,
          meetUpPoint: true,
          startTimeHour: true,
          startTimeMinute: true,
          startTimePeriod: true,
          timezone: true,
          workoutId: true,
          mapImageUrl: true,
          routePhotos: true,
        },
      },
    },
    orderBy: { city_runs: { date: 'asc' } },
    take: limit * 2,
  });

  const upcoming = rsvps.filter((r) => {
    const run = r.city_runs;
    return !isCityRunPast(
      {
        date: run.date,
        startTimeHour: run.startTimeHour,
        startTimeMinute: run.startTimeMinute,
        startTimePeriod: run.startTimePeriod,
        timezone: run.timezone,
      },
      nowMs
    );
  });

  const slice = upcoming.slice(0, limit);
  const runIds = slice.map((r) => r.city_runs.id);
  const goingRsvps = runIds.length
    ? await prisma.city_run_rsvps.findMany({
        where: { runId: { in: runIds }, status: 'going' },
        include: {
          Athlete: {
            select: {
              id: true,
              firstName: true,
              gofastHandle: true,
              photoURL: true,
            },
          },
        },
      })
    : [];

  const rsvpsByRun = new Map<
    string,
    {
      count: number;
      avatars: {
        id: string;
        firstName: string | null;
        gofastHandle: string | null;
        photoURL: string | null;
      }[];
    }
  >();
  for (const r of goingRsvps) {
    const bucket = rsvpsByRun.get(r.runId) ?? { count: 0, avatars: [] };
    bucket.count += 1;
    if (bucket.avatars.length < 4) {
      bucket.avatars.push({
        id: r.Athlete.id,
        firstName: r.Athlete.firstName,
        gofastHandle: r.Athlete.gofastHandle,
        photoURL: r.Athlete.photoURL,
      });
    }
    rsvpsByRun.set(r.runId, bucket);
  }

  return slice.map((r) => {
    const run = r.city_runs;
    const stats = rsvpsByRun.get(run.id);
    return {
      id: run.id,
      slug: run.slug,
      title: run.title,
      date: run.date.toISOString(),
      citySlug: run.citySlug,
      gofastCity: run.citySlug ?? '',
      meetUpPoint: run.meetUpPoint,
      startTimeHour: run.startTimeHour,
      startTimeMinute: run.startTimeMinute,
      startTimePeriod: run.startTimePeriod,
      workoutId: run.workoutId,
      mapImageUrl: run.mapImageUrl,
      routePhotos: Array.isArray(run.routePhotos)
        ? (run.routePhotos as string[])
        : [],
      gorunPath: `/gorun/${run.id}`,
      isHost: r.role === RSVP_ROLE_HOST,
      goingCount: stats?.count ?? 0,
      goingAvatars: (stats?.avatars ?? []).slice(0, 3),
    };
  });
}
