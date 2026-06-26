/**
 * One-time backfill: scheduled_runs → workouts schedule fields.
 * Run before migration drop if SQL backfill missed edge cases (different-date linked runs with segments).
 *
 *   set -a && source .env.local && set +a && npx tsx prisma/scripts/backfill-scheduled-runs-to-workouts.ts
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { newEntityId } from '../../lib/training/new-entity-id';

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function duplicateWorkoutForSchedule(
  sourceId: string,
  athleteId: string,
  scheduleDate: Date,
  schedule: {
    startTimeLabel: string | null;
    meetupLocation: string | null;
    routeDescription: string | null;
    stravaRouteUrl: string | null;
    isTrack: boolean;
    shareSlug: string | null;
    estimatedDistanceMi: number | null;
  }
): Promise<string> {
  const source = await prisma.workouts.findFirstOrThrow({
    where: { id: sourceId },
    include: { segments: { orderBy: { stepOrder: 'asc' } } },
  });

  const newId = newEntityId();
  const estimatedDistanceInMeters =
    schedule.estimatedDistanceMi != null
      ? schedule.estimatedDistanceMi * 1609.34
      : source.estimatedDistanceInMeters;

  await prisma.workouts.create({
    data: {
      id: newId,
      title: source.title,
      description: source.description,
      workoutType: source.workoutType,
      athleteId,
      scope: source.scope,
      planId: null,
      catalogueWorkoutId: source.catalogueWorkoutId,
      date: scheduleDate,
      estimatedDistanceInMeters,
      nOffset: null,
      weekNumber: null,
      dayAssigned: null,
      planCycleIndex: null,
      scheduledStartTimeLabel: schedule.startTimeLabel,
      scheduledMeetupLocation: schedule.meetupLocation,
      scheduledRouteDescription: schedule.routeDescription,
      scheduledStravaRouteUrl: schedule.stravaRouteUrl,
      scheduledIsTrack: schedule.isTrack,
      scheduledShareSlug: schedule.shareSlug,
      segments:
        source.segments.length > 0
          ? {
              create: source.segments.map((seg) => ({
                id: newEntityId(),
                stepOrder: seg.stepOrder,
                title: seg.title,
                durationType: seg.durationType,
                durationValue: seg.durationValue,
                targets:
                  seg.targets === null || seg.targets === undefined
                    ? Prisma.DbNull
                    : (seg.targets as Prisma.InputJsonValue),
                repeatCount: seg.repeatCount,
                notes: seg.notes,
                paceTargetEncodingVersion: seg.paceTargetEncodingVersion,
                recoveryDurationType: seg.recoveryDurationType,
                recoveryDurationValue: seg.recoveryDurationValue,
              })),
            }
          : undefined,
    },
  });

  return newId;
}

async function main() {
  const runs = await prisma.$queryRaw<
    Array<{
      id: string;
      athleteId: string;
      workoutId: string | null;
      date: Date;
      startTimeLabel: string | null;
      title: string;
      estimatedDistanceMi: number | null;
      isTrack: boolean;
      stravaRouteUrl: string | null;
      meetupLocation: string | null;
      routeDescription: string | null;
      shareSlug: string | null;
    }>
  >`SELECT * FROM scheduled_runs ORDER BY "createdAt" ASC`;

  if (runs.length === 0) {
    console.log('No scheduled_runs rows to backfill.');
    return;
  }

  let updated = 0;
  let duplicated = 0;
  let created = 0;

  for (const run of runs) {
    const schedule = {
      startTimeLabel: run.startTimeLabel,
      meetupLocation: run.meetupLocation,
      routeDescription: run.routeDescription,
      stravaRouteUrl: run.stravaRouteUrl,
      isTrack: run.isTrack,
      shareSlug: run.shareSlug,
      estimatedDistanceMi: run.estimatedDistanceMi,
    };

    if (run.workoutId) {
      const workout = await prisma.workouts.findUnique({
        where: { id: run.workoutId },
        select: { id: true, date: true, scheduledShareSlug: true },
      });

      if (workout && workout.date && utcDayKey(workout.date) === utcDayKey(run.date)) {
        await prisma.workouts.update({
          where: { id: workout.id },
          data: {
            scheduledStartTimeLabel: schedule.startTimeLabel,
            scheduledMeetupLocation: schedule.meetupLocation,
            scheduledRouteDescription: schedule.routeDescription,
            scheduledStravaRouteUrl: schedule.stravaRouteUrl,
            scheduledIsTrack: schedule.isTrack,
            scheduledShareSlug: workout.scheduledShareSlug ?? schedule.shareSlug,
          },
        });
        updated++;
        continue;
      }

      if (workout) {
        await duplicateWorkoutForSchedule(run.workoutId, run.athleteId, run.date, schedule);
        duplicated++;
        continue;
      }
    }

    const estimatedDistanceInMeters =
      run.estimatedDistanceMi != null ? run.estimatedDistanceMi * 1609.34 : null;

    await prisma.workouts.create({
      data: {
        id: newEntityId(),
        title: run.title,
        workoutType: 'Easy',
        athleteId: run.athleteId,
        scope: 'ATHLETE',
        planId: null,
        date: run.date,
        estimatedDistanceInMeters,
        scheduledStartTimeLabel: schedule.startTimeLabel,
        scheduledMeetupLocation: schedule.meetupLocation,
        scheduledRouteDescription: schedule.routeDescription,
        scheduledStravaRouteUrl: schedule.stravaRouteUrl,
        scheduledIsTrack: schedule.isTrack,
        scheduledShareSlug: schedule.shareSlug,
      },
    });
    created++;
  }

  console.log('Backfill complete', { updated, duplicated, created, total: runs.length });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
