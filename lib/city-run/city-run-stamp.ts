import { WorkoutType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { buildCourseSnapFromRun, courseSnapToJson } from '@/lib/city-run/course-snap';
import { buildCityRunMatchLabel } from '@/lib/city-run/match-label';
import { pushPlannedWorkoutToGarminForAthlete } from '@/lib/garmin-workouts/push-workout-for-athlete';
import { ymdFromDate } from '@/lib/training/plan-utils';

export type CityRunStampResult =
  | {
      ok: true;
      plannedWorkoutId: string;
      cityRunMatchLabel: string;
      action: 'created' | 'updated' | 'fulfilled';
      garminPush?: { ok: boolean; message?: string };
    }
  | {
      ok: false;
      code: 'conflict_plan_day' | 'not_club_run' | 'not_found';
      message: string;
      existingPlanWorkoutId?: string;
    };

function deriveWorkoutTitle(run: {
  workoutDescription: string | null;
  title: string;
}): string {
  const desc = run.workoutDescription?.trim();
  if (desc) {
    const first = desc.split(/[\n.]/)[0]?.trim();
    if (first && first.length <= 40) return first;
  }
  const stripped = run.title.replace(/\s*\(\d{1,2}\/\d{1,2}\)\s*$/, '').trim();
  const parts = stripped.split(/\s+/);
  const last = parts[parts.length - 1];
  if (last && /^(run|tempo|intervals|longrun|easy)$/i.test(last)) {
    return last.charAt(0).toUpperCase() + last.slice(1).toLowerCase();
  }
  return 'Run';
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
 * Upsert athlete City Run stamp on I'm in. Fulfill same-day plan day when present.
 */
export async function upsertCityRunStampForAthlete(
  athleteId: string,
  cityRunId: string
): Promise<CityRunStampResult> {
  const run = await prisma.city_runs.findUnique({
    where: { id: cityRunId },
    include: {
      runClub: { select: { id: true, slug: true, name: true, matchToken: true } },
      route: {
        select: {
          id: true,
          name: true,
          stravaUrl: true,
          stravaMapUrl: true,
          mapImageUrl: true,
          distanceMiles: true,
        },
      },
    },
  });

  if (!run) {
    return { ok: false, code: 'not_found', message: 'Run not found' };
  }
  if (!run.runClubId || !run.runClub) {
    return { ok: false, code: 'not_club_run', message: 'Not a club run' };
  }

  const workoutTitle = deriveWorkoutTitle(run);
  const matchLabel = buildCityRunMatchLabel({
    club: run.runClub,
    dayOfWeek: run.dayOfWeek,
    runDate: run.date,
    workoutTitle,
  });
  const courseSnap = buildCourseSnapFromRun(run, 'city_run_rsvp');

  const existingStamp = await prisma.planned_workouts.findFirst({
    where: { athleteId, cityRunId },
  });

  const runDayStart = new Date(run.date);
  runDayStart.setUTCHours(0, 0, 0, 0);
  const runDayEnd = new Date(runDayStart);
  runDayEnd.setUTCDate(runDayEnd.getUTCDate() + 1);

  const planDayOnDate = await prisma.planned_workouts.findFirst({
    where: {
      athleteId,
      planId: { not: null },
      date: { gte: runDayStart, lt: runDayEnd },
      cityRunId: null,
    },
    orderBy: { updatedAt: 'desc' },
  });

  let action: 'created' | 'updated' | 'fulfilled' = existingStamp ? 'updated' : 'created';
  let plannedWorkoutId: string;

  if (existingStamp) {
    const updated = await prisma.planned_workouts.update({
      where: { id: existingStamp.id },
      data: {
        date: run.date,
        courseSnapJson: courseSnapToJson(courseSnap),
        cityRunMatchLabel: matchLabel,
        updatedAt: new Date(),
      },
    });
    plannedWorkoutId = updated.id;
  } else if (planDayOnDate) {
    action = 'fulfilled';
    const updated = await prisma.planned_workouts.update({
      where: { id: planDayOnDate.id },
      data: {
        cityRunId,
        courseSnapJson: courseSnapToJson(courseSnap),
        cityRunMatchLabel: matchLabel,
        updatedAt: new Date(),
      },
    });
    plannedWorkoutId = updated.id;
  } else {
    const conflictingPlanDay = await prisma.planned_workouts.findFirst({
      where: {
        athleteId,
        cityRunId: { not: null },
        date: { gte: runDayStart, lt: runDayEnd },
        NOT: { cityRunId },
      },
    });
    if (conflictingPlanDay) {
      return {
        ok: false,
        code: 'conflict_plan_day',
        message: 'You already have a club run stamp on this date.',
        existingPlanWorkoutId: conflictingPlanDay.id,
      };
    }

    const created = await prisma.planned_workouts.create({
      data: {
        title: workoutTitle,
        workoutType: WorkoutType.Easy,
        athleteId,
        planId: null,
        cityRunId,
        date: run.date,
        estimatedDistanceInMeters:
          run.totalMiles != null ? Math.round(run.totalMiles * 1609.34) : null,
        courseSnapJson: courseSnapToJson(courseSnap),
        cityRunMatchLabel: matchLabel,
        updatedAt: new Date(),
      },
    });
    plannedWorkoutId = created.id;
  }

  await ensureMinimalSegments(plannedWorkoutId, run.totalMiles);

  let garminPush: { ok: boolean; message?: string } | undefined;
  try {
    const pushResult = await pushPlannedWorkoutToGarminForAthlete(athleteId, plannedWorkoutId, {
      scheduleDateYmdOverride: ymdFromDate(run.date),
    });
    garminPush = pushResult.ok
      ? { ok: true }
      : { ok: false, message: pushResult.message };
  } catch (err) {
    garminPush = {
      ok: false,
      message: err instanceof Error ? err.message : 'Garmin push failed',
    };
  }

  return {
    ok: true,
    plannedWorkoutId,
    cityRunMatchLabel: matchLabel,
    action,
    garminPush,
  };
}
