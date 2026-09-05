import { WorkoutType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { buildCourseSnapFromRun, courseSnapToJson } from '@/lib/city-run/course-snap';
import { buildCityRunMatchLabel } from '@/lib/city-run/match-label';

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

async function ensureMinimalSegments(plannedWorkoutId: string, miles: number | null) {
  const count = await prisma.planned_workout_segments.count({
    where: { plannedWorkoutId },
  });
  if (count > 0) return;

  const distanceMeters =
    miles != null && miles > 0 ? Math.round(miles * 1609.34) : 5000;

  await prisma.planned_workout_segments.create({
    data: {
      plannedWorkoutId,
      stepOrder: 1,
      title: 'Run',
      durationType: 'DISTANCE',
      durationValue: distanceMeters,
      paceTargetEncodingVersion: 2,
      updatedAt: new Date(),
    },
  });
}

/**
 * Upsert a planned_workouts stamp when an athlete RSVPs going to an individual (join-my-run) city run.
 * Does not push Garmin — host's workout is separate training context.
 */
export async function upsertIndividualCityRunStampForAthlete(
  athleteId: string,
  cityRunId: string
): Promise<{ ok: true; plannedWorkoutId: string; action: 'created' | 'updated' } | { ok: false; code: 'not_individual' | 'not_found' }> {
  const run = await prisma.city_runs.findUnique({
    where: { id: cityRunId },
    include: {
      runClub: { select: { id: true, slug: true, name: true, matchToken: true } },
    },
  });

  if (!run) {
    return { ok: false, code: 'not_found' };
  }
  if (run.cityRunType !== 'INDIVIDUAL') {
    return { ok: false, code: 'not_individual' };
  }

  const courseSnap = buildCourseSnapFromRun(run, 'city_run_rsvp');
  const courseJson = courseSnapToJson(courseSnap);
  const matchLabel = run.runClub
    ? buildCityRunMatchLabel({
        club: run.runClub,
        dayOfWeek: run.dayOfWeek,
        runDate: run.date,
        workoutTitle: run.title,
      })
    : run.title.trim() || 'Run';

  const existing = await prisma.planned_workouts.findFirst({
    where: { athleteId, cityRunId },
    select: { id: true },
  });

  if (existing) {
    await prisma.planned_workouts.update({
      where: { id: existing.id },
      data: {
        date: run.date,
        courseSnapJson: courseJson,
        cityRunMatchLabel: matchLabel,
        updatedAt: new Date(),
      },
    });
    return { ok: true, plannedWorkoutId: existing.id, action: 'updated' };
  }

  const created = await prisma.planned_workouts.create({
    data: {
      id: generateId(),
      title: run.title.trim() || 'Run',
      workoutType: WorkoutType.Easy,
      athleteId,
      planId: null,
      cityRunId,
      date: run.date,
      estimatedDistanceInMeters:
        run.totalMiles != null ? Math.round(run.totalMiles * 1609.34) : null,
      courseSnapJson: courseJson,
      cityRunMatchLabel: matchLabel,
      updatedAt: new Date(),
    },
  });

  await ensureMinimalSegments(created.id, run.totalMiles);

  return { ok: true, plannedWorkoutId: created.id, action: 'created' };
}
