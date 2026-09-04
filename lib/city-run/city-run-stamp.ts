import { WorkoutType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { buildCourseSnapFromRun, courseSnapToJson } from '@/lib/city-run/course-snap';
import { buildCityRunMatchLabel } from '@/lib/city-run/match-label';
import {
  clonePlannedWorkoutForAthlete,
  resyncAthleteStampFromTemplate,
} from '@/lib/club-planned-workouts/clone-planned-for-athlete';
import { pushPlannedWorkoutToGarminForAthlete } from '@/lib/garmin-workouts/push-workout-for-athlete';
import { ymdFromDate } from '@/lib/training/plan-utils';
import { resolveWorkoutTargetForAthlete } from '@/lib/training/workout-or-planned-resolve';

export type CityRunStampMode = 'use_city' | 'keep_mine';

export type CityRunStampOptions = {
  stampMode?: CityRunStampMode;
  /** Plan-day workout id from invite flow (prescribe or instance id). */
  sourceWorkoutId?: string;
};

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
  runType: string | null;
  plannedWorkout?: { title: string } | null;
}): string {
  if (run.plannedWorkout?.title?.trim()) {
    return run.plannedWorkout.title.trim();
  }
  const desc = run.workoutDescription?.trim();
  if (desc) {
    const first = desc.split(/[\n.]/)[0]?.trim();
    if (first && first.length <= 40) return first;
  }
  const stripped = run.title.replace(/\s*\(\d{1,2}\/\d{1,2}\)\s*$/, '').trim();
  const parts = stripped.split(/\s+/);
  const last = parts[parts.length - 1];
  if (last && /^(run|tempo|intervals|longrun|easy|track)$/i.test(last)) {
    const normalized = last.toLowerCase();
    if (normalized === 'track') return 'Track';
    return last.charAt(0).toUpperCase() + last.slice(1).toLowerCase();
  }
  if (run.runType?.trim().toLowerCase() === 'track') return 'Track';
  return 'Run';
}

async function ensureMinimalSegments(
  plannedWorkoutId: string,
  miles: number | null,
  fallbackTitle = 'Run'
) {
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
      title: fallbackTitle,
      durationType: 'DISTANCE',
      durationValue: distanceMeters,
      paceTargetEncodingVersion: 2,
      updatedAt: new Date(),
    },
  });
}

/**
 * Upsert athlete City Run stamp on I'm in. Fulfill same-day plan day when present.
 * Explicit stampMode from invite flow overrides auto fulfill/clone behavior.
 */
export async function upsertCityRunStampForAthlete(
  athleteId: string,
  cityRunId: string,
  options?: CityRunStampOptions
): Promise<CityRunStampResult> {
  const run = await prisma.city_runs.findUnique({
    where: { id: cityRunId },
    include: {
      runClub: { select: { id: true, slug: true, name: true, matchToken: true } },
      plannedWorkout: {
        include: { segments: { orderBy: { stepOrder: 'asc' } } },
      },
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

  const template = run.plannedWorkout;
  const workoutTitle = deriveWorkoutTitle(run);
  const fallbackSegmentTitle =
    run.runType?.trim().toLowerCase() === 'track' ? 'Track' : workoutTitle;
  const matchLabel = buildCityRunMatchLabel({
    club: run.runClub,
    dayOfWeek: run.dayOfWeek,
    runDate: run.date,
    workoutTitle,
  });
  const courseSnap = buildCourseSnapFromRun(run, 'city_run_rsvp');
  const courseJson = courseSnapToJson(courseSnap);

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

  if (options?.stampMode === 'keep_mine' && options.sourceWorkoutId) {
    const target = await resolveWorkoutTargetForAthlete(options.sourceWorkoutId, athleteId);
    if (target?.kind === 'planned') {
      const updated = await prisma.planned_workouts.update({
        where: { id: target.plannedWorkoutId },
        data: {
          cityRunId,
          courseSnapJson: courseJson,
          cityRunMatchLabel: matchLabel,
          updatedAt: new Date(),
        },
      });
      plannedWorkoutId = updated.id;
      action = existingStamp?.id === updated.id ? 'updated' : 'fulfilled';
    } else {
      return {
        ok: false,
        code: 'not_found',
        message: 'Could not link your plan workout to this run.',
      };
    }
  } else if (options?.stampMode === 'use_city') {
    if (existingStamp) {
      plannedWorkoutId = existingStamp.id;
      if (template?.id) {
        await resyncAthleteStampFromTemplate(existingStamp.id, template.id, {
          date: run.date,
          courseSnapJson: courseJson,
          cityRunMatchLabel: matchLabel,
        });
      } else {
        await prisma.planned_workouts.update({
          where: { id: existingStamp.id },
          data: {
            date: run.date,
            courseSnapJson: courseJson,
            cityRunMatchLabel: matchLabel,
            updatedAt: new Date(),
          },
        });
      }
    } else if (template?.id) {
      const cloned = await clonePlannedWorkoutForAthlete(template.id, athleteId, {
        cityRunId,
        date: run.date,
        courseSnapJson: courseJson,
        cityRunMatchLabel: matchLabel,
      });
      plannedWorkoutId = cloned.id;
      action = 'created';
    } else {
      const created = await prisma.planned_workouts.create({
        data: {
          title: workoutTitle,
          workoutType:
            run.runType?.trim().toLowerCase() === 'track'
              ? WorkoutType.Intervals
              : WorkoutType.Easy,
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
      plannedWorkoutId = created.id;
      action = 'created';
      await ensureMinimalSegments(
        plannedWorkoutId,
        run.totalMiles,
        fallbackSegmentTitle
      );
    }
  } else if (existingStamp) {
    plannedWorkoutId = existingStamp.id;
    if (existingStamp.planId == null && template?.id) {
      await resyncAthleteStampFromTemplate(existingStamp.id, template.id, {
        date: run.date,
        courseSnapJson: courseJson,
        cityRunMatchLabel: matchLabel,
      });
    } else {
      await prisma.planned_workouts.update({
        where: { id: existingStamp.id },
        data: {
          date: run.date,
          courseSnapJson: courseJson,
          cityRunMatchLabel: matchLabel,
          updatedAt: new Date(),
        },
      });
    }
  } else if (planDayOnDate) {
    action = 'fulfilled';
    const updated = await prisma.planned_workouts.update({
      where: { id: planDayOnDate.id },
      data: {
        cityRunId,
        courseSnapJson: courseJson,
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

    if (template?.id) {
      const cloned = await clonePlannedWorkoutForAthlete(template.id, athleteId, {
        cityRunId,
        date: run.date,
        courseSnapJson: courseJson,
        cityRunMatchLabel: matchLabel,
      });
      plannedWorkoutId = cloned.id;
    } else {
      const created = await prisma.planned_workouts.create({
        data: {
          title: workoutTitle,
          workoutType:
            run.runType?.trim().toLowerCase() === 'track'
              ? WorkoutType.Intervals
              : WorkoutType.Easy,
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
      plannedWorkoutId = created.id;
      await ensureMinimalSegments(
        plannedWorkoutId,
        run.totalMiles,
        fallbackSegmentTitle
      );
    }
  }

  if (!template?.segments?.length) {
    const segCount = await prisma.planned_workout_segments.count({
      where: { plannedWorkoutId },
    });
    if (segCount === 0) {
      await ensureMinimalSegments(
        plannedWorkoutId,
        run.totalMiles,
        fallbackSegmentTitle
      );
    }
  }

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
