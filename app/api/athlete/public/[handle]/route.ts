export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { RunWorkflowStatus } from '@prisma/client';

const PUBLIC_RUN_WORKFLOW: RunWorkflowStatus[] = ['PENDING', 'SUBMITTED', 'APPROVED'];

function normalizeHandle(raw: string): string {
  let h = (raw || '').trim().toLowerCase();
  if (h.startsWith('@')) h = h.slice(1);
  return h.replace(/[^a-z0-9_]/g, '');
}

/**
 * GET /api/athlete/public/[handle]
 * Public, unauthenticated. Safe fields only. 404 if no athlete with this gofastHandle.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle: raw } = await params;
    const handle = normalizeHandle(raw || '');
    if (!handle) {
      return NextResponse.json({ error: 'Handle required' }, { status: 400 });
    }

    const athlete = await prisma.athlete.findFirst({
      where: { gofastHandle: { equals: handle, mode: 'insensitive' } },
    });

    if (!athlete) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const now = new Date();

    const raceSignupRows = await prisma.athlete_race_signups.findMany({
      where: { athleteId: athlete.id },
      include: {
        race_registry: {
          select: {
            id: true,
            name: true,
            slug: true,
            raceDate: true,
            city: true,
            state: true,
            distanceMiles: true,
            raceType: true,
            isActive: true,
            isCancelled: true,
          },
        },
      },
      orderBy: { race_registry: { raceDate: 'asc' } },
      take: 24,
    });

    const signedUpRaces = raceSignupRows
      .filter((row) => row.race_registry?.isActive && !row.race_registry.isCancelled)
      .map((row) => {
        const r = row.race_registry;
        return {
          id: r.id,
          name: r.name,
          slug: r.slug,
          raceDate: r.raceDate.toISOString(),
          city: r.city,
          state: r.state,
          distanceMiles: r.distanceMiles,
          raceType: r.raceType,
        };
      });

    const upcomingRuns = await prisma.city_runs.findMany({
      where: {
        athleteGeneratedId: athlete.id,
        date: { gte: now },
        workflowStatus: { in: PUBLIC_RUN_WORKFLOW },
      },
      orderBy: { date: 'asc' },
      take: 20,
      select: {
        id: true,
        slug: true,
        title: true,
        date: true,
        gofastCity: true,
        meetUpPoint: true,
        startTimeHour: true,
        startTimeMinute: true,
        startTimePeriod: true,
        workoutId: true,
      },
    });

    let trainingSummary: {
      planName: string;
      startDate: string;
      totalWeeks: number;
      raceName: string | null;
    } | null = null;

    const plan = await prisma.training_plans.findFirst({
      where: { athleteId: athlete.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        name: true,
        startDate: true,
        totalWeeks: true,
        race_registry: { select: { name: true } },
      },
    });
    if (plan) {
      trainingSummary = {
        planName: plan.name,
        startDate: plan.startDate.toISOString(),
        totalWeeks: plan.totalWeeks,
        raceName: plan.race_registry?.name ?? null,
      };
    }

    let primaryChasingGoal: {
      id: string;
      name: string | null;
      distance: string;
      goalTime: string | null;
      targetByDate: string;
      raceName: string | null;
      raceSlug: string | null;
    } | null = null;

    if (!trainingSummary) {
      const chasing = await prisma.athleteGoal.findFirst({
        where: { athleteId: athlete.id, status: 'ACTIVE' },
        orderBy: { targetByDate: 'asc' },
        include: {
          race_registry: {
            select: { name: true, slug: true },
          },
        },
      });
      if (chasing) {
        primaryChasingGoal = {
          id: chasing.id,
          name: chasing.name,
          distance: chasing.distance,
          goalTime: chasing.goalTime,
          targetByDate: chasing.targetByDate.toISOString(),
          raceName: chasing.race_registry?.name ?? null,
          raceSlug: chasing.race_registry?.slug ?? null,
        };
      }
    }

    const lastActivity = await prisma.athlete_activities.findFirst({
      where: {
        athleteId: athlete.id,
        ingestionStatus: 'MATCHED',
      },
      orderBy: { startTime: 'desc' },
      select: {
        activityName: true,
        startTime: true,
        distance: true,
        duration: true,
        activityType: true,
      },
    });

    let lastRun: {
      activityName: string | null;
      startTime: string | null;
      distanceMiles: number | null;
      durationSeconds: number | null;
      activityType: string | null;
    } | null = null;
    if (lastActivity?.startTime) {
      const miles =
        lastActivity.distance != null && lastActivity.distance > 0
          ? lastActivity.distance / 1609.34
          : null;
      lastRun = {
        activityName: lastActivity.activityName,
        startTime: lastActivity.startTime.toISOString(),
        distanceMiles: miles,
        durationSeconds: lastActivity.duration ?? null,
        activityType: lastActivity.activityType,
      };
    }

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const workoutRows = await prisma.workouts.findMany({
      where: {
        athleteId: athlete.id,
        date: { gte: startOfToday },
      },
      orderBy: { date: 'asc' },
      take: 12,
      select: {
        id: true,
        title: true,
        workoutType: true,
        date: true,
      },
    });
    const upcomingWorkouts = workoutRows.map((w) => ({
      id: w.id,
      title: w.title,
      workoutType: w.workoutType,
      date: w.date ? w.date.toISOString() : null,
    }));

    return NextResponse.json({
      success: true,
      athlete: {
        gofastHandle: athlete.gofastHandle,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        photoURL: athlete.photoURL,
        runPhotoURL: athlete.runPhotoURL,
        bio: athlete.bio,
        city: athlete.city,
        state: athlete.state,
        primarySport: athlete.primarySport,
      },
      trainingSummary,
      primaryChasingGoal,
      lastRun,
      signedUpRaces,
      upcomingWorkouts,
      upcomingRuns: upcomingRuns.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        date: r.date.toISOString(),
        gofastCity: r.gofastCity,
        meetUpPoint: r.meetUpPoint,
        startTimeHour: r.startTimeHour,
        startTimeMinute: r.startTimeMinute,
        startTimePeriod: r.startTimePeriod,
        workoutId: r.workoutId,
        gorunPath: `/gorun/${r.id}`,
      })),
    });
  } catch (e: unknown) {
    console.error('GET /api/athlete/public/[handle]:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
