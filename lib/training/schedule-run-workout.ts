import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { newEntityId } from '@/lib/training/new-entity-id';

function handlePrefix(gofastHandle: string | null | undefined): string {
  const h = (gofastHandle || '')
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[^a-z0-9]/g, '');
  if (h.length > 0) return h.slice(0, 32);
  return 'run';
}

function sixDigits(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Unique scheduledShareSlug for /join/scheduled-run/[slug].
 * Format: [handlePrefix][6digits], e.g. acole842719
 */
export async function assignUniqueWorkoutScheduledShareSlug(params: {
  workoutId: string;
  gofastHandle: string | null | undefined;
}): Promise<string> {
  const prefix = handlePrefix(params.gofastHandle);
  for (let attempt = 0; attempt < 80; attempt++) {
    const slug = `${prefix}${sixDigits()}`;
    const clash = await prisma.workouts.findFirst({
      where: {
        scheduledShareSlug: slug,
        NOT: { id: params.workoutId },
      },
      select: { id: true },
    });
    if (!clash) {
      await prisma.workouts.update({
        where: { id: params.workoutId },
        data: { scheduledShareSlug: slug },
      });
      return slug;
    }
  }
  const fallback = `run${Date.now().toString(36)}${sixDigits()}`;
  await prisma.workouts.update({
    where: { id: params.workoutId },
    data: { scheduledShareSlug: fallback },
  });
  return fallback;
}

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type ScheduleRunWorkoutInput = {
  athleteId: string;
  title: string;
  date: Date;
  startTimeLabel?: string | null;
  workoutId?: string | null;
  estimatedDistanceMi?: number | null;
  isTrack?: boolean;
  stravaRouteUrl?: string | null;
  meetupLocation?: string | null;
  routeDescription?: string | null;
};

export type ScheduleRunWorkoutRow = {
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
  createdAt: Date;
  updatedAt: Date;
};

function metersToMi(meters: number | null | undefined): number | null {
  if (meters == null || meters <= 0) return null;
  return Math.round((meters / 1609.34) * 10) / 10;
}

/** Map a workouts row to legacy ScheduledRunJson shape (id = workout id). */
export function workoutToScheduleRunRow(w: {
  id: string;
  athleteId: string | null;
  date: Date | null;
  title: string;
  estimatedDistanceInMeters: number | null;
  scheduledStartTimeLabel: string | null;
  scheduledIsTrack: boolean;
  scheduledStravaRouteUrl: string | null;
  scheduledMeetupLocation: string | null;
  scheduledRouteDescription: string | null;
  scheduledShareSlug: string | null;
  planId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ScheduleRunWorkoutRow | null {
  if (!w.athleteId || !w.date) return null;
  return {
    id: w.id,
    athleteId: w.athleteId,
    workoutId: w.id,
    date: w.date,
    startTimeLabel: w.scheduledStartTimeLabel,
    title: w.title,
    estimatedDistanceMi: metersToMi(w.estimatedDistanceInMeters),
    isTrack: w.scheduledIsTrack,
    stravaRouteUrl: w.scheduledStravaRouteUrl,
    meetupLocation: w.scheduledMeetupLocation,
    routeDescription: w.scheduledRouteDescription,
    shareSlug: w.scheduledShareSlug,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  };
}

async function duplicateWorkoutWithSchedule(
  sourceId: string,
  athleteId: string,
  scheduleDate: Date,
  scheduleFields: {
    startTimeLabel: string | null;
    meetupLocation: string | null;
    routeDescription: string | null;
    stravaRouteUrl: string | null;
    isTrack: boolean;
    title: string;
    estimatedDistanceMi: number | null;
  }
): Promise<string> {
  const source = await prisma.workouts.findFirstOrThrow({
    where: { id: sourceId, athleteId },
    include: { segments: { orderBy: { stepOrder: 'asc' } } },
  });

  const newId = newEntityId();
  const estimatedDistanceInMeters =
    scheduleFields.estimatedDistanceMi != null
      ? scheduleFields.estimatedDistanceMi * 1609.34
      : source.estimatedDistanceInMeters;

  await prisma.workouts.create({
    data: {
      id: newId,
      title: scheduleFields.title || source.title,
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
      scheduledStartTimeLabel: scheduleFields.startTimeLabel,
      scheduledMeetupLocation: scheduleFields.meetupLocation,
      scheduledRouteDescription: scheduleFields.routeDescription,
      scheduledStravaRouteUrl: scheduleFields.stravaRouteUrl,
      scheduledIsTrack: scheduleFields.isTrack,
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

/**
 * Create or update a scheduled workout row.
 * - Same workout + same date → update schedule fields on existing row.
 * - Same workout + different date → duplicate workout then apply schedule fields.
 * - No workoutId → create standalone workout.
 */
export async function upsertScheduleRunWorkout(
  input: ScheduleRunWorkoutInput
): Promise<{ workoutId: string }> {
  const scheduleFields = {
    startTimeLabel: input.startTimeLabel ?? null,
    meetupLocation: input.meetupLocation ?? null,
    routeDescription: input.routeDescription ?? null,
    stravaRouteUrl: input.stravaRouteUrl ?? null,
    isTrack: input.isTrack ?? false,
    title: input.title,
    estimatedDistanceMi: input.estimatedDistanceMi ?? null,
  };

  if (input.workoutId) {
    const existing = await prisma.workouts.findFirst({
      where: { id: input.workoutId, athleteId: input.athleteId },
      select: { id: true, date: true },
    });
    if (!existing) {
      throw new Error('WORKOUT_NOT_FOUND');
    }

    if (existing.date && utcDayKey(existing.date) === utcDayKey(input.date)) {
      const estimatedDistanceInMeters =
        scheduleFields.estimatedDistanceMi != null
          ? scheduleFields.estimatedDistanceMi * 1609.34
          : undefined;

      await prisma.workouts.update({
        where: { id: existing.id },
        data: {
          title: scheduleFields.title,
          scheduledStartTimeLabel: scheduleFields.startTimeLabel,
          scheduledMeetupLocation: scheduleFields.meetupLocation,
          scheduledRouteDescription: scheduleFields.routeDescription,
          scheduledStravaRouteUrl: scheduleFields.stravaRouteUrl,
          scheduledIsTrack: scheduleFields.isTrack,
          ...(estimatedDistanceInMeters != null
            ? { estimatedDistanceInMeters }
            : {}),
        },
      });
      return { workoutId: existing.id };
    }

    const newId = await duplicateWorkoutWithSchedule(
      existing.id,
      input.athleteId,
      input.date,
      scheduleFields
    );
    return { workoutId: newId };
  }

  const estimatedDistanceInMeters =
    scheduleFields.estimatedDistanceMi != null
      ? scheduleFields.estimatedDistanceMi * 1609.34
      : null;

  const newId = newEntityId();
  await prisma.workouts.create({
    data: {
      id: newId,
      title: scheduleFields.title,
      workoutType: 'Easy',
      athleteId: input.athleteId,
      scope: 'ATHLETE',
      planId: null,
      date: input.date,
      estimatedDistanceInMeters,
      scheduledStartTimeLabel: scheduleFields.startTimeLabel,
      scheduledMeetupLocation: scheduleFields.meetupLocation,
      scheduledRouteDescription: scheduleFields.routeDescription,
      scheduledStravaRouteUrl: scheduleFields.stravaRouteUrl,
      scheduledIsTrack: scheduleFields.isTrack,
    },
  });

  return { workoutId: newId };
}

/** Workouts that represent scheduled runs in a date window. */
export function scheduleRunWorkoutWhere(athleteId: string, start: Date, end: Date) {
  return {
    athleteId,
    date: { gte: start, lt: end },
    OR: [
      { scheduledStartTimeLabel: { not: null } },
      { scheduledShareSlug: { not: null } },
      { scheduledMeetupLocation: { not: null } },
      { scheduledRouteDescription: { not: null } },
      { scheduledStravaRouteUrl: { not: null } },
      { scheduledIsTrack: true },
      { planId: null },
    ],
  };
}
